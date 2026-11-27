# [ahmed] Run broadcasts after successful database commits.
from datetime import datetime, time, timedelta, timezone as datetime_timezone
import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_slug
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, F, OuterRef, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.utils.cache import patch_vary_headers

# [ahmed] Broadcast calendar events through Redis.
from realtime.broadcast import broadcast_calendar_event
from notifications.models import Notification
from notifications.services import NotificationService

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import filters, serializers, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from accounts.models import ClubBoardAssignment, EmailVerification
from accounts.permissions import IsSuperAdmin
from .models import Club, ClubEvent, Department, Rsvp, UserMember
from .serializers import (
    ClubEventSerializer,
    ClubSerializer,
    DepartmentSerializer,
    AttendeeSerializer,
    PaginatedAttendeeSerializer,
    RsvpStatusSerializer,
    SignupResendSerializer,
    SignupSerializer,
    SignupVerificationSerializer,
    UserMemberSerializer,
)


User = get_user_model()


# How long a sign-up code works. The email (send_signup_verification) and the site's sign-up page say the same.
SIGNUP_CODE_LIFETIME = timedelta(minutes=10)

VALIDATION_ERROR_RESPONSE = OpenApiResponse(
    response={
        'type': 'object',
        'additionalProperties': {
            'oneOf': [
                {'type': 'string'},
                {'type': 'array', 'items': {'type': 'string'}},
            ],
        },
    },
    description='A query parameter is duplicate, empty, malformed, or unsupported.',
)


class EmailDeliveryFailed(Exception):
    pass


def send_signup_verification(email, code):
    sent = send_mail(
        'Your Campus Hub verification code',
        f'Your verification code is {code}. It expires in {SIGNUP_CODE_LIFETIME.seconds // 60} minutes.',
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )
    if sent != 1:
        raise EmailDeliveryFailed


# Shared calendar broadcasts are public. Keep this allowlist separate from the
# request-aware API serializer so future private fields do not become public by
# accident.
PUBLIC_EVENT_BROADCAST_FIELDS = frozenset({
    'id',
    'title',
    'name',
    'description',
    'parent_id',
    'club',
    'club_id',
    'club_name',
    'club_slug',
    'parent',
    'department_name',
    'department_slug',
    'flyer_url',
    'starts_at',
    'ends_at',
    'start_time',
    'end_time',
    'location',
    'category',
    'status',
    'capacity',
    'created_at',
    'updated_at',
    # RSVP totals are public aggregate data, unlike attendee identities and
    # the requesting user's RSVP status.
    'rsvps_count',
})


def public_event_broadcast_data(serializer_data):
    """Return the public-safe projection for the shared calendar group."""
    serialized_data = dict(serializer_data)
    event_data = {
        key: value
        for key, value in serialized_data.items()
        if key in PUBLIC_EVENT_BROADCAST_FIELDS
    }

    # Preserve the future event response shape without publishing the caller's
    # personal state or any attendee identity.
    if 'has_user_rsvpd' in serialized_data:
        event_data['has_user_rsvpd'] = False
    if 'attendees_preview' in serialized_data:
        event_data['attendees_preview'] = []

    return event_data


EVENT_LIST_PARAMETERS = [
    OpenApiParameter(
        name='category',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        enum=sorted(value for value, _ in ClubEvent.CATEGORY_CHOICES),
        description='Exact event category.',
    ),
    OpenApiParameter(
        name='club',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description='Exact club slug, for example `leet-dev`.',
    ),
    OpenApiParameter(
        name='department',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description='Exact department slug, for example `1337`.',
    ),
    OpenApiParameter(
        name='status',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        enum=sorted(value for value, _ in ClubEvent.STATUS_CHOICES),
        description='Exact event status.',
    ),
    OpenApiParameter(
        name='from',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description='ISO 8601 date or datetime lower overlap boundary.',
    ),
    OpenApiParameter(
        name='to',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description='ISO 8601 date or datetime upper overlap boundary.',
    ),
    OpenApiParameter(
        name='upcoming',
        type=OpenApiTypes.BOOL,
        location=OpenApiParameter.QUERY,
        description='`true` keeps events whose end time is in the future.',
    ),
    OpenApiParameter(
        name='rsvped',
        type=OpenApiTypes.BOOL,
        location=OpenApiParameter.QUERY,
        description=(
            '`true` requires authentication and returns only events for which '
            'the current user has an active RSVP. Includes past and upcoming events.'
        ),
    ),
    OpenApiParameter(
        name='search',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description=(
            'Case-insensitive search across title/name, description, club name, '
            'and location. Maximum 200 characters.'
        ),
    ),
    OpenApiParameter(
        name='page_size',
        type={'type': 'integer', 'minimum': 1, 'maximum': 200},
        location=OpenApiParameter.QUERY,
        description='Results per page. Defaults to 20; maximum 200.',
    ),
]


class ClubEventPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200

    def get_page_size(self, request):
        values = request.query_params.getlist(self.page_size_query_param)
        if not values:
            return self.page_size
        if len(values) != 1:
            raise ValidationError({
                self.page_size_query_param: 'Provide this parameter once.',
            })

        try:
            page_size = int(values[0])
        except (TypeError, ValueError):
            page_size = 0

        if not 1 <= page_size <= self.max_page_size:
            raise ValidationError({
                self.page_size_query_param: (
                    f'Use an integer from 1 to {self.max_page_size}.'
                ),
            })
        return page_size


class AttendeePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ClubEventFilterBackend(filters.BaseFilterBackend):
    category_values = {value for value, _ in ClubEvent.CATEGORY_CHOICES}
    status_values = {value for value, _ in ClubEvent.STATUS_CHOICES}

    @staticmethod
    def get_single_value(request, name):
        values = request.query_params.getlist(name)
        if not values:
            return None
        if len(values) != 1:
            raise ValidationError({name: 'Provide this parameter once.'})
        if values[0] == '':
            raise ValidationError({name: 'This parameter cannot be empty.'})
        return values[0]

    @staticmethod
    def parse_utc_boundary(value, name):
        boundary = parse_datetime(value)
        if boundary is None:
            parsed_date = parse_date(value)
            if parsed_date is not None:
                boundary = datetime.combine(
                    parsed_date,
                    time.min,
                    tzinfo=datetime_timezone.utc,
                )

        if boundary is None:
            raise ValidationError({
                name: 'Use an ISO 8601 date or datetime.',
            })
        if timezone.is_naive(boundary):
            boundary = timezone.make_aware(
                boundary,
                datetime_timezone.utc,
            )
        return boundary

    @staticmethod
    def validate_slug_parameter(value, name):
        try:
            validate_slug(value)
        except DjangoValidationError as exc:
            raise ValidationError({
                name: 'Use a valid URL slug.',
            }) from exc

    def filter_queryset(self, request, queryset, view):
        search_values = request.query_params.getlist('search')
        if len(search_values) > 1:
            raise ValidationError({
                'search': 'Provide this parameter once.',
            })
        if search_values and len(search_values[0]) > 200:
            raise ValidationError({
                'search': 'Use at most 200 characters.',
            })

        category = self.get_single_value(request, 'category')
        club = self.get_single_value(request, 'club')
        department = self.get_single_value(request, 'department')
        status_value = self.get_single_value(request, 'status')
        from_value = self.get_single_value(request, 'from')
        to_value = self.get_single_value(request, 'to')
        upcoming = self.get_single_value(request, 'upcoming')
        rsvped = self.get_single_value(request, 'rsvped')

        if request.query_params.getlist('ordering'):
            raise ValidationError({
                'ordering': 'Events use fixed chronological ordering.',
            })

        if category is not None:
            if category not in self.category_values:
                raise ValidationError({
                    'category': 'Choose a documented event category.',
                })
            queryset = queryset.filter(category=category)

        if status_value is not None:
            if status_value not in self.status_values:
                raise ValidationError({
                    'status': 'Choose a documented event status.',
                })
            queryset = queryset.filter(status=status_value)

        if club is not None:
            self.validate_slug_parameter(club, 'club')
            queryset = queryset.filter(club__slug=club)

        if department is not None:
            self.validate_slug_parameter(department, 'department')
            queryset = queryset.filter(parent_id__slug=department)

        start_boundary = None
        end_boundary = None
        if from_value is not None:
            start_boundary = self.parse_utc_boundary(from_value, 'from')
        if to_value is not None:
            end_boundary = self.parse_utc_boundary(to_value, 'to')
        if (
            start_boundary is not None
            and end_boundary is not None
            and start_boundary >= end_boundary
        ):
            raise ValidationError({
                'to': 'The upper boundary must be after the lower boundary.',
            })
        if start_boundary is not None:
            queryset = queryset.filter(ends_at__gt=start_boundary)
        if end_boundary is not None:
            queryset = queryset.filter(starts_at__lt=end_boundary)

        if upcoming is not None:
            normalized = upcoming.lower()
            if normalized not in {'true', 'false'}:
                raise ValidationError({
                    'upcoming': 'Use true or false.',
                })
            if normalized == 'true':
                queryset = queryset.filter(ends_at__gt=timezone.now())

        if rsvped is not None:
            normalized = rsvped.lower()
            if normalized not in {'true', 'false'}:
                raise ValidationError({
                    'rsvped': 'Use true or false.',
                })
            if normalized == 'true':
                if not request.user or not request.user.is_authenticated:
                    # Permission selection normally rejects this earlier. Keep
                    # the filter fail-closed when called directly as well.
                    from rest_framework.exceptions import NotAuthenticated
                    raise NotAuthenticated()
                queryset = queryset.filter(rsvps__user=request.user)

        return queryset.order_by(
            F('starts_at').asc(nulls_last=True),
            'pk',
        )


class CanCreateClubEvent(BasePermission):
    message = 'Only a superadmin or an assigned club board member can create events.'

    def has_permission(self, request, view):
        if IsSuperAdmin().has_permission(request, view):
            return True

        club_id = request.data.get('club')
        if (
            not request.user
            or not request.user.is_authenticated
            or getattr(request.user, 'role', None) != 'BOARD_MEMBER'
            or not club_id
        ):
            return False

        return ClubBoardAssignment.objects.filter(
            user=request.user,
            club_id=club_id,
        ).exists()

# [ahmed] Protect changes to existing club events.
class CanModifyClubEvent(BasePermission):
    message = "Only a superadmin or this club's assigned board member can modify it."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if IsSuperAdmin().has_permission(request, view):
            return True

        return bool(
            getattr(request.user, 'role', None) == 'BOARD_MEMBER'
            and
            obj.club_id
            and ClubBoardAssignment.objects.filter(
                user=request.user,
                club_id=obj.club_id,
            ).exists()
        )


@extend_schema_view(
    list=extend_schema(
        summary='List public events',
        description=(
            'Returns a page-number envelope ordered by `starts_at` ascending, '
            'nulls last, then primary key. Filters combine with AND. Date bounds '
            'use interval overlap. Client-selected `ordering` is unsupported and '
            'returns 400; chronological ordering is fixed.'
        ),
        parameters=EVENT_LIST_PARAMETERS,
        responses={
            200: ClubEventSerializer(many=True),
            400: VALIDATION_ERROR_RESPONSE,
        },
        auth=[],
    ),
    retrieve=extend_schema(
        summary='Retrieve a public event',
        description=(
            'Public event detail. RSVP totals are public; current-user state and '
            'attendee previews are request-aware and hide identities anonymously.'
        ),
        responses={200: ClubEventSerializer, 404: OpenApiResponse(description='Not found.')},
        auth=[],
    ),
    create=extend_schema(
        summary='Create an event',
        description=(
            'Requires a superadmin or a BOARD_MEMBER with a matching '
            'ClubBoardAssignment.'
        ),
    ),
    update=extend_schema(
        summary='Replace an event',
        description='Requires management permission for the event club.',
    ),
    partial_update=extend_schema(
        summary='Update an event',
        description='Requires management permission for the event club.',
    ),
    destroy=extend_schema(
        summary='Delete an event',
        description='Requires management permission for the event club.',
    ),
)
class ClubEventViewSet(viewsets.ModelViewSet):
    queryset = ClubEvent.objects.select_related('parent_id', 'club').all()
    serializer_class = ClubEventSerializer
    filter_backends = [ClubEventFilterBackend, SearchFilter]
    search_fields = ['name', 'description', 'club__name', 'location']
    pagination_class = ClubEventPagination

    def hydrate_rsvp_state(self, event):
        """Attach request-aware RSVP values without serializer-side queries."""
        if not isinstance(event, ClubEvent):
            return
        event.rsvps_count = event.rsvps.count()
        request = getattr(self, 'request', None)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            event.has_user_rsvpd = event.rsvps.filter(user=user).exists()
            event.attendees_preview_rsvps = list(
                event.rsvps.select_related('user').order_by('-created_at')[:3]
            )

    def get_queryset(self):
        queryset = super().get_queryset().annotate(
            rsvps_count=Count('rsvps', distinct=True),
        )
        user = getattr(self.request, 'user', None)
        is_rsvp_history = (
            self.request.query_params.get('rsvped', '').lower() == 'true'
        )
        if user and user.is_authenticated:
            queryset = queryset.annotate(
                has_user_rsvpd=Exists(
                    Rsvp.objects.filter(event=OuterRef('pk'), user=user)
                )
            )
            if not is_rsvp_history:
                queryset = queryset.prefetch_related(
                    Prefetch(
                        'rsvps',
                        queryset=(
                            Rsvp.objects.select_related('user')
                            .order_by('-created_at')[:3]
                        ),
                        to_attr='attendees_preview_rsvps',
                    )
                )
        return queryset

    def get_permissions(self):
        if (
            self.action == 'list'
            and self.request.query_params.get('rsvped', '').lower() == 'true'
        ):
            return [IsAuthenticated()]
        if self.action in ('rsvp', 'attendees'):
            return [IsAuthenticated()]

        if self.action == "create":
            return [CanCreateClubEvent()]

        if self.action in ("update", "partial_update", "destroy"):
            return [CanModifyClubEvent()]

        return [AllowAny()]

    @extend_schema(
        request=None,
        responses={
            200: RsvpStatusSerializer,
            201: RsvpStatusSerializer,
            401: OpenApiResponse(description='Authentication required.'),
            404: OpenApiResponse(description='Event not found.'),
            409: OpenApiResponse(
                description='Event capacity has been reached or registration has ended (code: event_ended).',
            ),
        },
    )
    @action(
        detail=True,
        methods=['post', 'delete'],
        permission_classes=[IsAuthenticated],
        url_path='rsvp',
    )
    def rsvp(self, request, pk=None):
        with transaction.atomic():
            try:
                event = (
                    ClubEvent.objects.select_related('parent_id', 'club')
                    .select_for_update(of=('self',))
                    .get(pk=pk)
                )
            except ClubEvent.DoesNotExist:
                return Response(
                    {'detail': 'Event not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            existing = Rsvp.objects.filter(event=event, user=request.user)
            rsvp_changed = False
            if request.method == 'POST':
                if existing.exists():
                    response_status = status.HTTP_200_OK
                else:
                    if event.ends_at is not None and event.ends_at <= timezone.now():
                        return Response(
                            {
                                'code': 'event_ended',
                                'detail': 'Registration is closed because this event has ended.',
                                'rsvps_count': Rsvp.objects.filter(event=event).count(),
                                'has_user_rsvpd': False,
                            },
                            status=status.HTTP_409_CONFLICT,
                        )
                    if event.capacity is not None:
                        current_count = Rsvp.objects.filter(event=event).count()
                        if current_count >= event.capacity:
                            return Response(
                                {
                                    'detail': 'Event capacity has been reached.',
                                    'rsvps_count': current_count,
                                    'has_user_rsvpd': False,
                                },
                                status=status.HTTP_409_CONFLICT,
                            )
                    rsvp = Rsvp.objects.create(event=event, user=request.user)
                    NotificationService.create(
                        recipient=request.user,
                        notification_type=Notification.Type.RSVP_CONFIRMED,
                        title="RSVP confirmed",
                        message=f'You are registered for "{event.name}".',
                        event=event,
                        deduplication_key=f"rsvp-confirmed:{rsvp.pk}",
                    )
                    rsvp_changed = True
                    response_status = status.HTTP_201_CREATED
                has_user_rsvpd = True
            else:
                existing_rsvp = existing.first()
                if existing_rsvp is not None:
                    NotificationService.create(
                        recipient=request.user,
                        notification_type=Notification.Type.RSVP_CANCELLED,
                        title="RSVP cancelled",
                        message=f'Your registration for "{event.name}" was cancelled.',
                        event=event,
                        deduplication_key=f"rsvp-cancelled:{existing_rsvp.pk}",
                    )
                    existing_rsvp.delete()
                    rsvp_changed = True
                response_status = status.HTTP_200_OK
                has_user_rsvpd = False

            rsvps_count = Rsvp.objects.filter(event=event).count()
            if rsvp_changed:
                # [ahmed] Publish the public count after commit. Clients refetch their own RSVP state.
                event.rsvps_count = rsvps_count
                event_data = public_event_broadcast_data(ClubEventSerializer(event).data)
                transaction.on_commit(
                    lambda: broadcast_calendar_event('event_updated', event_data),
                    robust=True,
                )

        return Response(
            {
                'rsvps_count': rsvps_count,
                'has_user_rsvpd': has_user_rsvpd,
            },
            status=response_status,
        )

    @extend_schema(
        responses={
            200: PaginatedAttendeeSerializer,
            401: OpenApiResponse(description='Authentication required.'),
            404: OpenApiResponse(description='Event not found.'),
        }
    )
    @action(
        detail=True,
        methods=['get'],
        permission_classes=[IsAuthenticated],
        url_path='attendees',
    )
    def attendees(self, request, pk=None):
        event = self.get_object()
        queryset = (
            User.objects.filter(rsvps__event=event)
            .order_by('-rsvps__created_at', '-pk')
        )
        paginator = AttendeePagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AttendeeSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    # [ahmed] Automatically broadcast new events after creation.
    def perform_create(self, serializer):
        # Validation has already succeeded. Persist the event and its personal
        # notification records as one transaction.
        if isinstance(serializer, ClubEventSerializer):
            with transaction.atomic():
                return self._perform_create(serializer)
        # Preserve the lightweight hook contract used by broadcast unit tests.
        return self._perform_create(serializer)

    def _perform_create(self, serializer):
        # [ahmed] Save the new event.
        serializer.save()
        event = serializer.instance
        self.hydrate_rsvp_state(event)

        # [ahmed] Get the saved event's serialized data.
        event_data = public_event_broadcast_data(serializer.data)

        # New public events are campus-wide student announcements. Roles are
        # the available account-level audience boundary; club membership is
        # intentionally irrelevant to this product decision.
        if isinstance(event, ClubEvent):
            student_user_ids = User.objects.filter(
                is_active=True,
                is_staff=False,
                is_superuser=False,
                role__in=(User.Role.STUDENT, User.Role.BOARD_MEMBER),
            ).values_list("pk", flat=True)
            NotificationService.create_for_users(
                recipients=student_user_ids,
                notification_type=Notification.Type.NEW_EVENT,
                title="New campus event",
                message=f'A new campus event, "{event.name}", was published.',
                event=event,
                deduplication_key=f"new-event:{event.pk}",
            )

        # [ahmed] Broadcast only after a successful database commit.
        transaction.on_commit(
            lambda: broadcast_calendar_event("event_created", event_data),
            robust=True,
        )

    # [ahmed] Broadcast changes when an event is updated.
    def perform_update(self, serializer):
        if isinstance(serializer, ClubEventSerializer):
            with transaction.atomic():
                return self._perform_update(serializer)
        return self._perform_update(serializer)

    def _perform_update(self, serializer):
        if not isinstance(serializer.instance, ClubEvent):
            serializer.save()
            event_data = public_event_broadcast_data(serializer.data)
            transaction.on_commit(
                lambda: broadcast_calendar_event("event_updated", event_data),
                robust=True,
            )
            return

        meaningful_fields = {
            "name", "description", "starts_at", "ends_at", "location",
            "status", "category", "capacity", "club", "parent_id",
        }
        changed_fields = {
            field
            for field, value in serializer.validated_data.items()
            if field in meaningful_fields and getattr(serializer.instance, field) != value
        }
        old_status = serializer.instance.status

        # [ahmed] Save the modified event in the database.
        serializer.save()
        event = serializer.instance
        self.hydrate_rsvp_state(event)
        event_data = public_event_broadcast_data(serializer.data)

        if changed_fields:
            recipient_ids = Rsvp.objects.filter(
                event=event,
                user__is_active=True,
            ).values_list("user_id", flat=True)
            cancelled = old_status != "cancelled" and event.status == "cancelled"
            notification_type = (
                Notification.Type.EVENT_CANCELLED
                if cancelled else Notification.Type.EVENT_UPDATED
            )
            title = "Event cancelled" if cancelled else "Event updated"
            message = (
                f'"{event.name}" was cancelled.'
                if cancelled
                else f'An event you registered for, "{event.name}", changed.'
            )
            change_version = event.updated_at.isoformat()
            NotificationService.create_for_users(
                recipients=recipient_ids,
                notification_type=notification_type,
                title=title,
                message=message,
                event=event,
                deduplication_key=(
                    f"event-change:{event.pk}:{change_version}:{notification_type}"
                ),
            )

        # [ahmed] Notify clients after a successful commit.
        transaction.on_commit(
            lambda: broadcast_calendar_event("event_updated", event_data),
            robust=True,
        )

    # [ahmed] Broadcast when an event is deleted.
    def perform_destroy(self, instance):
        if isinstance(instance, ClubEvent):
            with transaction.atomic():
                # Use the current locked row so status and RSVP eligibility
                # cannot be based on a stale pre-permission-check instance.
                locked_event = ClubEvent.objects.select_for_update().get(
                    pk=instance.pk,
                )
                return self._perform_destroy(locked_event)
        # Preserve the lightweight hook contract used by broadcast unit tests.
        return self._perform_destroy(instance)

    def _perform_destroy(self, instance):
        # [ahmed] Keep the event ID before deleting it.
        event_id = instance.pk

        if (
            isinstance(instance, ClubEvent)
            and instance.status in {"planned", "ongoing"}
        ):
            recipient_ids = list(
                instance.rsvps.filter(user__is_active=True)
                .values_list("user_id", flat=True)
            )
            NotificationService.create_for_users(
                recipients=recipient_ids,
                notification_type=Notification.Type.EVENT_CANCELLED,
                title="Event removed",
                message=(
                    f'"{instance.name}" was removed and is no longer available.'
                ),
                event=instance,
                deduplication_key=f"event-deleted:{event_id}",
                delivery_event_id=None,
            )

        # [ahmed] Delete the event from the database.
        instance.delete()

        # [ahmed] Notify clients after successful deletion.
        transaction.on_commit(
            lambda: broadcast_calendar_event(
                "event_deleted",
                {"id": event_id},
            ),
            robust=True,
        )



@extend_schema_view(
    list=extend_schema(
        summary='List public departments',
        description=(
            'Returns a bare array. `name` is the frontend alias of the preserved '
            'legacy `title`; slug may be null until the A0 backfill is complete.'
        ),
        parameters=[
            OpenApiParameter(
                name='search',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Case-insensitive search by department title.',
            ),
        ],
        responses={200: DepartmentSerializer(many=True)},
        auth=[],
    ),
    retrieve=extend_schema(
        summary='Retrieve a public department',
        responses={200: DepartmentSerializer, 404: OpenApiResponse(description='Not found.')},
        auth=[],
    ),
)
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ['title']
    # [ahmed] Temporary fail-closed protection until shared roles are available.
    http_method_names = ['get', 'head', 'options']


class UserMemberViewSet(viewsets.ModelViewSet):
    queryset = UserMember.objects.select_related('department_id', 'club_id').all()
    serializer_class = UserMemberSerializer
    # Keep personal member data restricted to the integrated superadmin policy.
    permission_classes = [IsSuperAdmin]


@extend_schema_view(
    list=extend_schema(
        summary='List active public clubs',
        description=(
            'Returns a bare array and hides inactive clubs. Image URLs are '
            'absolute when request context is available; `logo_url` may be an '
            'empty string and `banner_url` may be null. President email and phone '
            'are not exposed anonymously.'
        ),
        responses={200: ClubSerializer(many=True)},
        auth=[],
    ),
    retrieve=extend_schema(
        summary='Retrieve a public club by slug',
        description=(
            'Slug-based detail route. President contact fields are omitted '
            'anonymously and included only for an authenticated active user.'
        ),
        responses={200: ClubSerializer, 404: OpenApiResponse(description='Not found.')},
        auth=[],
    ),
)
class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.select_related('department', 'head', 'head__user')
    serializer_class = ClubSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'
    # [ahmed] Temporary fail-closed protection until shared roles are available.
    http_method_names = ['get', 'head', 'options']

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        # The same URL has an authenticated representation with private fields.
        # Never allow a shared public cache to reuse it for another caller.
        patch_vary_headers(response, ('Authorization',))
        response['Cache-Control'] = 'private, no-store'
        return response

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action not in ('list', 'retrieve'):
            return queryset

        if self.action == 'list':
            queryset = queryset.filter(is_active=True)

        return queryset.annotate(
            member_count=Count('members', distinct=True),
            event_count=Count('events', distinct=True),
            upcoming_event_count=Count(
                'events',
                filter=Q(events__ends_at__gt=timezone.now()),
                distinct=True,
            ),
        )

@extend_schema(
    summary='Legacy email signup',
    description=(
        'Starts an email signup and sends a six-digit verification code. '
        'The account is created only after POST /api/signup/verify/.'
    ),
    request=SignupSerializer,
    responses={
        202: inline_serializer(
            name='SignupVerificationPendingResponse',
            fields={
                'detail': serializers.CharField(read_only=True),
                'email': serializers.EmailField(read_only=True),
                'verification_required': serializers.BooleanField(read_only=True),
            },
        ),
        400: VALIDATION_ERROR_RESPONSE,
    },
    auth=[],
)
@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    identity = serializer.validated_data
    email = identity['email']
    if User.objects.filter(email__iexact=email).exists():
        return Response(
            {'email': 'An account with this email already exists.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    code = f'{secrets.randbelow(900_000) + 100_000:06d}'
    department = identity['department_id']
    club = identity.get('club_id')
    registration_data = {
        'password_hash': make_password(identity['password']),
        'first_name': identity['first_name'],
        'last_name': identity['last_name'],
        'year_of_study': identity['year_of_study'],
        'department_id': department.pk,
        'club_id': club.pk if club else None,
    }
    try:
        with transaction.atomic():
            existing = (
                EmailVerification.objects.select_for_update()
                .filter(email=email)
                .first()
            )
            if (
                existing is not None
                and existing.updated_at > now - timedelta(seconds=60)
            ):
                return Response(
                    {
                        'detail': 'If signup is pending for this address, a verification code has been sent.',
                        'email': email,
                        'verification_required': True,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )
            EmailVerification.objects.update_or_create(
                email=email,
                defaults={
                    'code_hash': make_password(code),
                    'registration_data': registration_data,
                    'attempts': 0,
                    'expires_at': now + SIGNUP_CODE_LIFETIME,
                },
            )
            send_signup_verification(email, code)
    except EmailDeliveryFailed:
        return Response(
            {'detail': 'The verification email could not be sent. Please retry.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(
        {
            'detail': 'A verification code has been sent to your email.',
            'email': email,
            'verification_required': True,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@extend_schema(
    request=SignupVerificationSerializer,
    responses={
        201: inline_serializer(
            name='VerifiedSignupResponse',
            fields={
                'token': serializers.CharField(read_only=True),
                'member': UserMemberSerializer(read_only=True),
            },
        ),
        400: VALIDATION_ERROR_RESPONSE,
    },
    auth=[],
)
@api_view(['POST'])
@permission_classes([AllowAny])
def verify_signup(request):
    serializer = SignupVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email']
    code = serializer.validated_data['code']
    invalid_code = Response(
        {'detail': 'The verification code is invalid or expired.'},
        status=status.HTTP_400_BAD_REQUEST,
    )

    with transaction.atomic():
        pending = (
            EmailVerification.objects.select_for_update()
            .filter(email=email)
            .first()
        )
        if (
            pending is None
            or pending.expires_at <= timezone.now()
            or pending.attempts >= 5
        ):
            return invalid_code
        if not check_password(code, pending.code_hash):
            pending.attempts += 1
            pending.save(update_fields=['attempts', 'updated_at'])
            return invalid_code
        if User.objects.filter(email__iexact=email).exists():
            pending.delete()
            return Response(
                {'email': 'An account with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = pending.registration_data
        department = Department.objects.filter(pk=data['department_id']).first()
        # BE20: new pending sign-ups no longer store club_id; rows created
        # before that change may still carry one, so read it optionally.
        club_id = data.get('club_id')
        club = Club.objects.filter(pk=club_id).first() if club_id else None
        if department is None or (
            club_id is not None
            and (club is None or club.department_id != department.pk)
        ):
            pending.delete()
            return Response(
                {'detail': 'Signup details are no longer valid. Please register again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = f'user_{secrets.token_hex(8)}'
        while User.objects.filter(username=username).exists():
            username = f'user_{secrets.token_hex(8)}'
        user = User(
            username=username,
            email=email,
            first_name=data['first_name'],
            last_name=data['last_name'],
        )
        user.password = data['password_hash']
        user.save()
        member = UserMember.objects.create(
            user=user,
            username=username,
            first_name=user.first_name,
            last_name=user.last_name,
            year_of_study=data['year_of_study'],
            department_id=department,
            club_id=club,
        )
        token, _ = Token.objects.get_or_create(user=user)
        pending.delete()

    return Response(
        {
            'token': token.key,
            'member': UserMemberSerializer(member).data,
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    request=SignupResendSerializer,
    responses={200: inline_serializer(
        name='SignupResendResponse',
        fields={'detail': serializers.CharField(read_only=True)},
    )},
    auth=[],
)
@api_view(['POST'])
@permission_classes([AllowAny])
def resend_signup_verification(request):
    serializer = SignupResendSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email']
    generic_response = {
        'detail': 'If signup is pending for this address, a new code has been sent.'
    }

    try:
        with transaction.atomic():
            pending = (
                EmailVerification.objects.select_for_update()
                .filter(email=email)
                .first()
            )
            if (
                pending is not None
                and not User.objects.filter(email__iexact=email).exists()
            ):
                now = timezone.now()
                if pending.updated_at > now - timedelta(seconds=60):
                    return Response(generic_response)
                code = f'{secrets.randbelow(900_000) + 100_000:06d}'
                pending.code_hash = make_password(code)
                pending.attempts = 0
                pending.expires_at = now + SIGNUP_CODE_LIFETIME
                pending.save(update_fields=[
                    'code_hash',
                    'attempts',
                    'expires_at',
                    'updated_at',
                ])
                send_signup_verification(email, code)
    except EmailDeliveryFailed:
        return Response(
            {'detail': 'The verification email could not be sent. Please retry.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(generic_response)
