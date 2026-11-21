# [ahmed] Run broadcasts after successful database commits.
from django.db import transaction
from django.db import IntegrityError
from django.contrib.auth import get_user_model

# [ahmed] Broadcast calendar events through Redis.
from realtime.broadcast import broadcast_calendar_event

from django.db.models import Q
from rest_framework import filters, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter

from accounts.models import ClubBoardAssignment
from accounts.permissions import IsSuperAdmin
from .models import Club, ClubEvent, Department, UserMember
from .serializers import (
    ClubEventSerializer,
    ClubSerializer,
    DepartmentSerializer,
    SignupSerializer,
    UserMemberSerializer,
)

User = get_user_model()


class ClubEventFilterBackend(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        department = request.query_params.get('department')
        category = request.query_params.get('category')

        if department:
            queryset = queryset.filter(parent_id_id=department)
        if category:
            queryset = queryset.filter(Q(name__icontains=category) | Q(description__icontains=category))
        return queryset


class CanCreateClubEvent(BasePermission):
    message = 'Only a superadmin or an assigned club board member can create events.'

    def has_permission(self, request, view):
        if IsSuperAdmin().has_permission(request, view):
            return True

        club_id = request.data.get('club')
        if (
            not request.user
            or not request.user.is_authenticated
            or request.user.role != "BOARD_MEMBER"
            or not club_id
        ):
            return False

        return ClubBoardAssignment.objects.filter(
            user=request.user,
            club_id=club_id,
        ).exists()

# [ahmed] Protect changes to existing club events.
class CanModifyClubEvent(BasePermission):
    message = "Only a superadmin or this event's assigned board member can modify it."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if IsSuperAdmin().has_permission(request, view):
            return True

        return bool(
            request.user.role == "BOARD_MEMBER"
            and obj.club_id
            and ClubBoardAssignment.objects.filter(
                user=request.user,
                club_id=obj.club_id,
            ).exists()
        )


class ClubEventViewSet(viewsets.ModelViewSet):
    queryset = ClubEvent.objects.select_related('parent_id').all()
    serializer_class = ClubEventSerializer
    filter_backends = [ClubEventFilterBackend, SearchFilter]
    search_fields = ['name', 'description', 'parent_id__title']

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



class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    filter_backends = [SearchFilter]
    search_fields = ['title']

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsSuperAdmin()]


class UserMemberViewSet(viewsets.ModelViewSet):
    queryset = UserMember.objects.select_related('department_id', 'club_id').all()
    serializer_class = UserMemberSerializer

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsSuperAdmin()]


class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.select_related('department', 'head').prefetch_related('members')
    serializer_class = ClubSerializer

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsSuperAdmin()]


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
