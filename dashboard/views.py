from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework import status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from accounts.models import ClubBoardAssignment
from accounts.permissions import IsClubBoard, IsSuperAdmin, user_club_id
from core_data.models import Club, ClubEvent, UserMember
from .models import Announcement, AuditLog, MembershipRequest
from .serializers import (
    AnnouncementSerializer,
    AuditLogSerializer,
    BoardClubSettingsSerializer,
    BoardStatsSerializer,
    BoardTeamMemberSerializer,
    MembershipRequestSerializer,
    EventWeekSerializer,
    OrganizationAdminSerializer,
    PaginatedAuditLogSerializer,
    PaginatedOrganizationSerializer,
    PaginatedSuperadminUserSerializer,
    RegistrationWeekSerializer,
    RoleDistributionSerializer,
    SuperadminUserCreateSerializer,
    SuperadminStatsSerializer,
    SuperadminUserSerializer,
    SuperadminUserUpdateSerializer,
)

User = get_user_model()


CLUB_IMAGE_FIELDS = ("logo", "banner")
NOT_GIVEN = object()
TRUE_VALUES = {"true", "1", "on", "yes"}


def club_payload(request):
    """Fields for the club serializer: without remove_logo/remove_banner and president."""
    handled_here = {f"remove_{field}" for field in CLUB_IMAGE_FIELDS} | {"president"}
    return {key: request.data.get(key) for key in request.data if key not in handled_here}


def resolve_president(club, request):
    """
    The user chosen as president, None to clear, or NOT_GIVEN. Raises a field error
    unless the user is an active member of this club's board team.
    """
    if "president" not in request.data:
        return NOT_GIVEN
    value = request.data.get("president")
    if value in (None, "", "null"):
        return None
    try:
        user_id = int(value)
    except (TypeError, ValueError):
        raise ValidationError({"president": "Choose a member of this club's board team."})
    user = User.objects.filter(
        pk=user_id,
        is_active=True,
        role=User.Role.BOARD_MEMBER,
        board_assignment__club=club,
    ).first()
    if user is None:
        raise ValidationError({"president": "Choose a member of this club's board team."})
    return user


def apply_president(club, president):
    """Make `president` (a board member of `club`) its head, or clear it with None."""
    if president is NOT_GIVEN:
        return
    if president is None:
        club.head = None
    else:
        member = UserMember.objects.filter(user=president).first()
        if member is None:
            username = president.username
            if UserMember.objects.filter(username=username).exists():
                username = f"{president.username}-{president.pk}"
            member = UserMember.objects.create(user=president, username=username)
        # The student site shows the head's name and phone: keep them in sync.
        member.first_name = president.first_name or president.username
        member.last_name = president.last_name
        if not member.phone and president.phone:
            member.phone = president.phone
        if member.department_id_id is None:
            member.department_id = club.department
        member.save()
        club.head = member
    club.save(update_fields=["head"])


def clear_presidencies(user, except_club=None):
    """A user who leaves a club's board stops being its president."""
    clubs = Club.objects.filter(head__user=user)
    if except_club is not None:
        clubs = clubs.exclude(pk=except_club.pk)
    clubs.update(head=None)


def club_image_removals(request):
    return {
        field
        for field in CLUB_IMAGE_FIELDS
        if str(request.data.get(f"remove_{field}", "")).lower() in TRUE_VALUES
    }


def save_club_images(serializer, previous_files, removals):
    """Save the club, apply removals, and delete replaced/removed files after commit."""
    club = serializer.save()
    cleared = [field for field in removals if field not in serializer.validated_data]
    for field in cleared:
        setattr(club, field, "")
    if cleared:
        club.save(update_fields=cleared)
    for field in CLUB_IMAGE_FIELDS:
        old_name = previous_files.get(field)
        file_field = getattr(club, field)
        if old_name and old_name != file_field.name:
            storage = file_field.storage
            transaction.on_commit(lambda name=old_name, storage=storage: storage.delete(name))
    return club


ORGANIZATION_FIELDS = {
    "name",
    "department",
    "is_active",
    "logo",
    "banner",
    "remove_logo",
    "remove_banner",
    "president",
}


class SuperadminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


def board_club(request):
    club_id = user_club_id(request.user)
    return Club.objects.filter(pk=club_id).first()


@extend_schema(responses={200: BoardStatsSerializer})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def board_stats(request):
    club = board_club(request)
    if club is None:
        return Response({"detail": "No club is assigned to this board member."}, status=404)

    now = timezone.now()
    this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month = (this_month - timedelta(days=1)).replace(day=1)
    try:
        Rsvp = apps.get_model("core_data", "Rsvp")
    except LookupError:
        registrations_this_month = None
        registrations_last_month = None
    else:
        registrations = Rsvp.objects.filter(event__club=club)
        registrations_this_month = registrations.filter(
            created_at__gte=this_month,
            created_at__lt=now,
        ).count()
        registrations_last_month = registrations.filter(
            created_at__gte=last_month,
            created_at__lt=this_month,
        ).count()

    return Response(
        {
            "total_events": ClubEvent.objects.filter(club=club).count(),
            "active_members": User.objects.filter(board_assignment__club=club).count(),
            "pending_requests": MembershipRequest.objects.filter(
                club=club,
                status=MembershipRequest.Status.PENDING,
            ).count(),
            "events_this_month": ClubEvent.objects.filter(
                club=club, created_at__gte=this_month
            ).count(),
            "registrations_this_month": registrations_this_month,
            "registrations_last_month": registrations_last_month,
        }
    )


@extend_schema(
    methods=["GET"],
    request=None,
    responses={200: BoardClubSettingsSerializer},
)
@extend_schema(
    methods=["PATCH"],
    request=BoardClubSettingsSerializer,
    responses={200: BoardClubSettingsSerializer},
)
@api_view(["GET", "PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def board_club_settings(request):
    club = board_club(request)
    if club is None:
        return Response({"detail": "No club is assigned to this board member."}, status=404)
    if request.method == "PATCH":
        allowed_fields = {
            "name",
            "description",
            "contact_email",
            "meeting_day",
            "meeting_time",
            "meeting_location",
            "logo",
            "banner",
            "remove_logo",
            "remove_banner",
            "president",
        }
        unknown_fields = set(request.data) - allowed_fields
        if unknown_fields:
            return Response(
                {"detail": "Unsupported club setting field."},
                status=400,
            )
        previous_files = {field: getattr(club, field).name for field in CLUB_IMAGE_FIELDS}
        serializer = BoardClubSettingsSerializer(
            club,
            data=club_payload(request),
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        president = resolve_president(club, request)
        with transaction.atomic():
            club = save_club_images(serializer, previous_files, club_image_removals(request))
            apply_president(club, president)
        AuditLog.objects.create(
            actor=request.user,
            action="club_settings_updated",
            target=club.name,
        )
    return Response(BoardClubSettingsSerializer(club, context={"request": request}).data)


@extend_schema(responses={200: RegistrationWeekSerializer(many=True)})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def board_registrations_weekly(request):
    club = board_club(request)
    if club is None:
        return Response({"detail": "No club is assigned to this board member."}, status=404)
    try:
        Rsvp = apps.get_model("core_data", "Rsvp")
    except LookupError:
        return Response({"detail": "Registration data is not available yet."}, status=503)

    start_date = timezone.now().date() - timedelta(days=6)
    rows = (
        Rsvp.objects.filter(event__club=club, created_at__date__gte=start_date)
        .values("created_at__date")
        .annotate(registrations=Count("id"))
        .order_by("created_at__date")
    )
    counts = {row["created_at__date"]: row["registrations"] for row in rows}
    return Response(
        [
            {
                "date": (start_date + timedelta(days=offset)).isoformat(),
                "registrations": counts.get(start_date + timedelta(days=offset), 0),
            }
            for offset in range(7)
        ]
    )


@extend_schema(responses={200: BoardTeamMemberSerializer(many=True)})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def board_members(request):
    # Club membership exists only for board members (students never join
    # clubs), so a club's members are its board team.
    club = board_club(request)
    if club is None:
        return Response([])
    team = User.objects.filter(board_assignment__club=club).order_by(
        "first_name", "last_name", "username"
    )
    return Response(BoardTeamMemberSerializer(team, many=True).data)


@extend_schema(responses={200: MembershipRequestSerializer(many=True)})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def board_requests(request):
    club = board_club(request)
    if club is None:
        return Response([])
    requests = MembershipRequest.objects.filter(club=club).select_related("member")
    return Response(MembershipRequestSerializer(requests, many=True).data)


@extend_schema(request=None, responses={200: MembershipRequestSerializer})
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def decide_request(request, request_id, decision):
    if decision not in {"approve", "reject"}:
        return Response({"detail": "Decision must be approve or reject."}, status=400)
    club = board_club(request)
    membership_request = MembershipRequest.objects.filter(
        pk=request_id,
        club=club,
    ).first()
    if membership_request is None:
        return Response({"detail": "Membership request not found."}, status=404)
    if membership_request.status != MembershipRequest.Status.PENDING:
        return Response({"detail": "Membership request already decided."}, status=400)

    membership_request.status = (
        MembershipRequest.Status.APPROVED
        if decision == "approve"
        else MembershipRequest.Status.REJECTED
    )
    membership_request.decided_by = request.user
    membership_request.decided_at = timezone.now()
    membership_request.save()

    if decision == "approve":
        membership_request.member.club_id = club
        membership_request.member.save(update_fields=["club_id"])

    AuditLog.objects.create(
        actor=request.user,
        action=(
            "membership_request_approved"
            if decision == "approve"
            else "membership_request_rejected"
        ),
        target=f"{membership_request.member.username} -> {club.name}",
    )
    return Response(MembershipRequestSerializer(membership_request).data)


class AnnouncementViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsClubBoard]
    serializer_class = AnnouncementSerializer
    queryset = Announcement.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Announcement.objects.none()
        club = board_club(self.request)
        if club is None:
            return Announcement.objects.none()
        return Announcement.objects.filter(club=club).order_by("-created_at")

    def perform_create(self, serializer):
        club = board_club(self.request)
        if club is None:
            raise PermissionDenied("No club is assigned to this board member.")
        announcement = serializer.save(club=club, created_by=self.request.user)
        AuditLog.objects.create(
            actor=self.request.user,
            action="announcement_created",
            target=announcement.title,
        )


@extend_schema(responses={200: SuperadminStatsSerializer})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_stats(request):
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return Response(
        {
            "total_users": User.objects.count(),
            "total_clubs": Club.objects.count(),
            "events_this_month": ClubEvent.objects.filter(
                starts_at__gte=month_start,
                starts_at__lt=now,
            ).count(),
            "pending_requests": MembershipRequest.objects.filter(
                status=MembershipRequest.Status.PENDING,
            ).count(),
        }
    )


@extend_schema(
    methods=["POST"],
    request=OrganizationAdminSerializer,
    responses={201: OrganizationAdminSerializer},
)
@extend_schema(responses={200: PaginatedOrganizationSerializer})
@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_organizations(request):
    if request.method == "POST":
        if set(request.data) - ORGANIZATION_FIELDS:
            return Response(
                {"detail": "Unsupported organization field."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = OrganizationAdminSerializer(
            data=club_payload(request),
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            organization = serializer.save()
            AuditLog.objects.create(
                actor=request.user,
                action="organization_created",
                target=organization.name,
            )
        return Response(
            OrganizationAdminSerializer(organization, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    queryset = Club.objects.select_related("department", "head__user").order_by("name")
    paginator = SuperadminPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(
        OrganizationAdminSerializer(page, many=True, context={"request": request}).data
    )


@extend_schema(
    methods=["PATCH"],
    request=OrganizationAdminSerializer,
    responses={200: OrganizationAdminSerializer},
)
@extend_schema(
    methods=["DELETE"],
    request=None,
    responses={204: None},
)
@api_view(["PATCH", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_organization_detail(request, organization_id):
    organization = Club.objects.filter(pk=organization_id).first()
    if organization is None:
        return Response({"detail": "Organization not found."}, status=404)

    if request.method == "DELETE":
        organization_name = organization.name
        if organization.board_assignments.exists():
            return Response(
                {
                    "detail": (
                        "Reassign or demote this organization's board members "
                        "before deleting it."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        with transaction.atomic():
            AuditLog.objects.create(
                actor=request.user,
                action="organization_deleted",
                target=organization_name,
            )
            organization.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if set(request.data) - ORGANIZATION_FIELDS:
        return Response(
            {"detail": "Unsupported organization field."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    previous_status = organization.is_active
    previous_files = {field: getattr(organization, field).name for field in CLUB_IMAGE_FIELDS}
    serializer = OrganizationAdminSerializer(
        organization,
        data=club_payload(request),
        partial=True,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    president = resolve_president(organization, request)
    with transaction.atomic():
        organization = save_club_images(
            serializer,
            previous_files,
            club_image_removals(request),
        )
        apply_president(organization, president)
        if previous_status != organization.is_active:
            action = "club_reactivated" if organization.is_active else "club_suspended"
        else:
            action = "organization_updated"
        AuditLog.objects.create(
            actor=request.user,
            action=action,
            target=organization.name,
        )
    return Response(OrganizationAdminSerializer(organization, context={"request": request}).data)


@extend_schema(
    methods=["POST"],
    request=SuperadminUserCreateSerializer,
    responses={201: SuperadminUserSerializer},
)
@extend_schema(responses={200: PaginatedSuperadminUserSerializer})
@api_view(["GET", "POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_users(request):
    if request.method == "POST":
        allowed_fields = {
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "club_id",
        }
        if set(request.data) - allowed_fields:
            return Response(
                {"detail": "Unsupported user field."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SuperadminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
                AuditLog.objects.create(
                    actor=request.user,
                    action="user_created",
                    target=user.username,
                )
        except IntegrityError:
            username = serializer.validated_data["username"]
            email = serializer.validated_data["email"]
            if User.objects.filter(username__iexact=username).exists():
                return Response(
                    {"username": "A user with this username already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(email__iexact=email).exists():
                return Response(
                    {"email": "A user with this email already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            raise
        return Response(
            SuperadminUserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )

    queryset = User.objects.select_related(
        "board_assignment__club",
    ).order_by("username")
    role = request.query_params.get("role")
    if role:
        if role not in User.Role.values:
            return Response({"detail": "Invalid role."}, status=400)
        queryset = queryset.filter(role=role)

    search = request.query_params.get("search")
    if search:
        queryset = queryset.filter(
            Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
        )

    paginator = SuperadminPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(
        SuperadminUserSerializer(page, many=True).data
    )


@extend_schema(
    methods=["PATCH"],
    request=SuperadminUserUpdateSerializer,
    responses={200: SuperadminUserSerializer},
)
@extend_schema(
    methods=["DELETE"],
    request=None,
    responses={204: None},
)
@api_view(["PATCH", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_user_detail(request, user_id):
    target = User.objects.filter(pk=user_id).first()
    if target is None:
        return Response({"detail": "User not found."}, status=404)

    if request.method == "DELETE":
        if target.pk == request.user.pk:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            target.role == User.Role.SUPERADMIN
            and target.is_active
            and not User.objects.filter(
                role=User.Role.SUPERADMIN,
                is_active=True,
            ).exclude(pk=target.pk).exists()
        ):
            return Response(
                {"detail": "The last active superadmin cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        username = target.username
        with transaction.atomic():
            AuditLog.objects.create(
                actor=request.user,
                action="user_deleted",
                target=username,
            )
            target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    allowed_fields = {
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "role",
        "club_id",
    }
    if set(request.data) - allowed_fields:
        return Response(
            {"detail": "Unsupported user field."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer = SuperadminUserUpdateSerializer(
        target,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    validated_data = serializer.validated_data
    new_role = validated_data.get("role", target.role)
    remains_active_superadmin = (
        new_role == User.Role.SUPERADMIN
        and validated_data.get("is_active", target.is_active)
    )
    if (
        target.role == User.Role.SUPERADMIN
        and target.is_active
        and not remains_active_superadmin
        and not User.objects.filter(
            role=User.Role.SUPERADMIN,
            is_active=True,
        ).exclude(pk=target.pk).exists()
    ):
        return Response(
            {"detail": "The last active superadmin cannot be demoted or disabled."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    assignment = (
        ClubBoardAssignment.objects.filter(user=target)
        .select_related("club")
        .first()
    )
    effective_club = validated_data.get(
        "club_id",
        assignment.club if assignment else None,
    )
    if (
        validated_data.get("club_id") is not None
        and new_role != User.Role.BOARD_MEMBER
    ):
        return Response(
            {"club_id": "Only board members may be assigned to a club."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if new_role == User.Role.BOARD_MEMBER and effective_club is None:
        return Response(
            {"club_id": "A board member must be assigned to a club."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        old_role = target.role
        changed_user_fields = []
        for field in ("username", "email", "first_name", "last_name", "is_active"):
            if field in validated_data and getattr(target, field) != validated_data[field]:
                setattr(target, field, validated_data[field])
                changed_user_fields.append(field)
        if "role" in validated_data:
            target.role = new_role
            if old_role != new_role:
                AuditLog.objects.create(
                    actor=request.user,
                    action="role_changed",
                    target=f"{target.username}: {old_role} -> {new_role}",
                )
            if old_role != new_role:
                changed_user_fields.append("role")
        if changed_user_fields:
            target.save(update_fields=changed_user_fields)
            if changed_user_fields != ["role"]:
                AuditLog.objects.create(
                    actor=request.user,
                    action="user_updated",
                    target=target.username,
                )

        if new_role != User.Role.BOARD_MEMBER and assignment is not None:
            old_club_name = assignment.club.name
            clear_presidencies(target)
            assignment.delete()
            AuditLog.objects.create(
                actor=request.user,
                action="board_assignment_removed",
                target=f"{target.username}: {old_club_name}",
            )
        elif (
            new_role == User.Role.BOARD_MEMBER
            and "club_id" in validated_data
        ):
            new_club = validated_data["club_id"]
            if assignment is None:
                ClubBoardAssignment.objects.create(user=target, club=new_club)
                AuditLog.objects.create(
                    actor=request.user,
                    action="board_assignment_created",
                    target=f"{target.username}: {new_club.name}",
                )
            elif assignment.club_id != new_club.pk:
                clear_presidencies(target, except_club=new_club)
                old_club_name = assignment.club.name
                assignment.club = new_club
                assignment.save(update_fields=["club"])
                AuditLog.objects.create(
                    actor=request.user,
                    action="board_assignment_changed",
                    target=f"{target.username}: {old_club_name} -> {new_club.name}",
                )

    return Response(SuperadminUserSerializer(target).data)


@extend_schema(responses={200: RoleDistributionSerializer(many=True)})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_role_distribution(request):
    counts = dict(
        User.objects.values_list("role")
        .annotate(user_count=Count("id"))
        .values_list("role", "user_count")
    )
    return Response(
        [
            {"role": role, "count": counts.get(role, 0)}
            for role in User.Role.values
        ]
    )


@extend_schema(responses={200: EventWeekSerializer(many=True)})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_events_weekly(request):
    today = timezone.localdate()
    current_week = today - timedelta(days=today.weekday())
    weeks = []
    for offset in range(6, -1, -1):
        week_start = current_week - timedelta(weeks=offset)
        week_end = week_start + timedelta(days=7)
        event_count = ClubEvent.objects.filter(
            starts_at__date__gte=week_start,
            starts_at__date__lt=week_end,
        ).count()
        weeks.append(
            {
                "week_start": week_start.isoformat(),
                "events": event_count,
            }
        )
    return Response(weeks)


@extend_schema(responses={200: PaginatedAuditLogSerializer})
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_audit_log(request):
    queryset = AuditLog.objects.select_related("actor").order_by("-created_at")
    paginator = SuperadminPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(
        AuditLogSerializer(page, many=True).data
    )
