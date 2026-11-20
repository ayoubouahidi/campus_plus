# [ahmed] Run broadcasts after successful database commits.
from datetime import datetime, time, timezone as datetime_timezone

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_slug
from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

# [ahmed] Broadcast calendar events through Redis.
from realtime.broadcast import broadcast_calendar_event

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
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, BasePermission, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from .models import Club, ClubEvent, Department, UserMember
from .serializers import (
    ClubEventSerializer,
    ClubSerializer,
    DepartmentSerializer,
    SignupSerializer,
    UserMemberSerializer,
)


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
    message = 'Only an admin or the club head can create an event.'

    def has_permission(self, request, view):
        if request.user and request.user.is_staff:
            return True

        club_id = request.data.get('club')
        if not request.user or not request.user.is_authenticated or not club_id:
            return False

        return Club.objects.filter(
            pk=club_id,
            head__user=request.user,
        ).exists()

# [ahmed] Protect changes to existing club events.
class CanModifyClubEvent(BasePermission):
    message = "Only an admin or this event's club head can modify it."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True

        return bool(
            obj.club_id
            and Club.objects.filter(
                pk=obj.club_id,
                head__user=request.user,
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
            'Public event detail. RSVP counts, the current user RSVP state, and '
            'attendee previews are not implemented and are intentionally absent.'
        ),
        responses={200: ClubEventSerializer, 404: OpenApiResponse(description='Not found.')},
        auth=[],
    ),
    create=extend_schema(
        summary='Create an event (interim management API)',
        description=(
            'Not part of the stable public read contract. Runtime permissions are '
            'temporary; final shared board/superadmin roles are not integrated.'
        ),
    ),
    update=extend_schema(
        summary='Replace an event (interim management API)',
        description='Non-public interim management operation; final roles are pending.',
    ),
    partial_update=extend_schema(
        summary='Update an event (interim management API)',
        description='Non-public interim management operation; final roles are pending.',
    ),
    destroy=extend_schema(
        summary='Delete an event (interim management API)',
        description='Non-public interim management operation; final roles are pending.',
    ),
)
class ClubEventViewSet(viewsets.ModelViewSet):
    queryset = ClubEvent.objects.select_related('parent_id', 'club').all()
    serializer_class = ClubEventSerializer
    filter_backends = [ClubEventFilterBackend, SearchFilter]
    search_fields = ['name', 'description', 'club__name', 'location']
    pagination_class = ClubEventPagination

    def get_permissions(self):
        if self.action == "create":
            return [CanCreateClubEvent()]

        if self.action in ("update", "partial_update", "destroy"):
            return [CanModifyClubEvent()]

        return [AllowAny()]

    # [ahmed] Automatically broadcast new events after creation.
    def perform_create(self, serializer):
        # [ahmed] Save the new event.
        serializer.save()

        # [ahmed] Get the saved event's serialized data.
        event_data = dict(serializer.data)

        # [ahmed] Broadcast only after a successful database commit.
        transaction.on_commit(
            lambda: broadcast_calendar_event(
                "event_created",
                event_data,
            )
        )

    # [ahmed] Broadcast changes when an event is updated.
    def perform_update(self, serializer):
        # [ahmed] Save the modified event in the database.
        serializer.save()

        # [ahmed] Get the event's updated information.
        event_data = dict(serializer.data)

        # [ahmed] Notify clients after a successful commit.
        transaction.on_commit(
            lambda: broadcast_calendar_event(
                "event_updated",
                event_data,
            )
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
            )
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

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsAdminUser()]


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
        'Existing legacy endpoint, not the unfinished custom-user authentication '
        'contract owned by Ayoub.'
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
    member = serializer.save()
    token, _ = Token.objects.get_or_create(user=member.user)
    return Response(
        {
            'token': token.key,
            'member': UserMemberSerializer(member).data,
        },
        status=status.HTTP_201_CREATED,
    )
