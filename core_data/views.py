# [ahmed] Run broadcasts after successful database commits.
from datetime import datetime, time, timezone as datetime_timezone

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_slug
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, F, OuterRef, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

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
from accounts.models import ClubBoardAssignment
from accounts.permissions import IsSuperAdmin
from .models import Club, ClubEvent, Department, Rsvp, UserMember
from .serializers import (
    ClubEventSerializer,
    ClubSerializer,
    DepartmentSerializer,
    AttendeeSerializer,
    PaginatedAttendeeSerializer,
    RsvpStatusSerializer,
    SignupSerializer,
    UserMemberSerializer,
)


User = get_user_model()


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
        if user and user.is_authenticated:
            queryset = queryset.annotate(
                has_user_rsvpd=Exists(
                    Rsvp.objects.filter(event=OuterRef('pk'), user=user)
                )
            ).prefetch_related(
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
            409: OpenApiResponse(description='Event capacity has been reached.'),
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
                event = ClubEvent.objects.select_for_update().get(pk=pk)
            except ClubEvent.DoesNotExist:
                return Response(
                    {'detail': 'Event not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            existing = Rsvp.objects.filter(event=event, user=request.user)
            if request.method == 'POST':
                if existing.exists():
                    response_status = status.HTTP_200_OK
                else:
                    current_count = Rsvp.objects.filter(event=event).count()
                    if event.capacity is not None and current_count >= event.capacity:
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
                response_status = status.HTTP_200_OK
                has_user_rsvpd = False

            rsvps_count = Rsvp.objects.filter(event=event).count()

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

        # The explicit membership link is the recipient policy. No platform-wide fanout.
        if isinstance(event, ClubEvent) and event.club_id:
            member_user_ids = UserMember.objects.filter(
                club_id=event.club_id,
                user__isnull=False,
                user__is_active=True,
            ).values_list("user_id", flat=True)
            NotificationService.create_for_users(
                recipients=member_user_ids,
                notification_type=Notification.Type.NEW_EVENT,
                title="New club event",
                message=f'Your club published "{event.name}".',
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
        # [ahmed] Keep the event ID before deleting it.
        event_id = instance.pk

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
            'Slug-based detail route. The response does not include private '
            'president contact fields.'
        ),
        responses={200: ClubSerializer, 404: OpenApiResponse(description='Not found.')},
        auth=[],
    ),
)
class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.select_related('department', 'head')
    serializer_class = ClubSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'
    # [ahmed] Temporary fail-closed protection until shared roles are available.
    http_method_names = ['get', 'head', 'options']

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
        'Preserved legacy email signup endpoint alongside the integrated accounts '
        'authentication API.'
    ),
    request=SignupSerializer,
    responses={
        201: inline_serializer(
            name='SignupResponse',
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
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            member = serializer.save()
    except IntegrityError:
        email = serializer.validated_data['email']
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {'email': 'An account with this email already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raise
    token, _ = Token.objects.get_or_create(user=member.user)
    return Response(
        {
            'token': token.key,
            'member': UserMemberSerializer(member).data,
        },
        status=status.HTTP_201_CREATED,
    )
