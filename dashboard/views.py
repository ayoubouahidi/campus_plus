from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.exceptions import FieldDoesNotExist
from django.db import transaction
from django.db.models import Count, Q
from django.utils.text import slugify
from django.utils import timezone
from datetime import timedelta
from rest_framework import status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import ClubBoardAssignment
from accounts.permissions import IsClubBoard, IsSuperAdmin, user_club_id
from core_data.models import Club, ClubEvent, UserMember
from .models import Announcement, AuditLog, MembershipRequest
from .serializers import (
    AnnouncementSerializer,
    AuditLogSerializer,
    BoardClubSettingsSerializer,
    BoardMemberSerializer,
    MembershipRequestSerializer,
    OrganizationAdminSerializer,
    OrganizationStatusSerializer,
    SuperadminUserSerializer,
    SuperadminUserUpdateSerializer,
)

User = get_user_model()


class SuperadminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


def board_club(request):
    club_id = user_club_id(request.user)
    return Club.objects.filter(pk=club_id).first()


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
            "active_members": UserMember.objects.filter(club_id=club).count(),
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
        }
        unknown_fields = set(request.data) - allowed_fields
        if unknown_fields:
            return Response(
                {"detail": "Unsupported club setting field."},
                status=400,
            )
        serializer = BoardClubSettingsSerializer(
            club,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        club = serializer.save()
        AuditLog.objects.create(
            actor=request.user,
            action="club_settings_updated",
            target=club.name,
        )
    return Response(BoardClubSettingsSerializer(club).data)


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


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def board_members(request):
    club = board_club(request)
    if club is None:
        return Response([])
    members = UserMember.objects.filter(club_id=club).select_related("user")
    return Response(BoardMemberSerializer(members, many=True).data)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsClubBoard])
def board_requests(request):
    club = board_club(request)
    if club is None:
        return Response([])
    requests = MembershipRequest.objects.filter(club=club).select_related("member")
    return Response(MembershipRequestSerializer(requests, many=True).data)


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

    def get_queryset(self):
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


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def join_club(request, slug):
    try:
        Club._meta.get_field("slug")
    except FieldDoesNotExist:
        club = next(
            (item for item in Club.objects.all() if slugify(item.name) == slug),
            None,
        )
    else:
        club = Club.objects.filter(slug=slug).first()
    if club is None:
        return Response({"detail": "Club not found."}, status=404)

    try:
        member = request.user.usermember
    except UserMember.DoesNotExist:
        member = UserMember.objects.create(
            user=request.user,
            username=request.user.username,
        )

    membership_request, created = MembershipRequest.objects.get_or_create(
        club=club,
        member=member,
        kind=MembershipRequest.Kind.JOIN,
        defaults={
            "note": str(request.data.get("note", "")),
        },
    )
    if not created:
        return Response(
            MembershipRequestSerializer(membership_request).data,
            status=200,
        )
    return Response(
        MembershipRequestSerializer(membership_request).data,
        status=201,
    )


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


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_organizations(request):
    queryset = Club.objects.select_related("department").order_by("name")
    paginator = SuperadminPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(
        OrganizationAdminSerializer(page, many=True).data
    )


@api_view(["PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_organization_detail(request, organization_id):
    unknown_fields = set(request.data) - {"is_active"}
    if unknown_fields:
        return Response(
            {"detail": "Only is_active may be changed."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer = OrganizationStatusSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    organization = Club.objects.filter(pk=organization_id).first()
    if organization is None:
        return Response({"detail": "Organization not found."}, status=404)

    is_active = serializer.validated_data["is_active"]
    if organization.is_active != is_active:
        organization.is_active = is_active
        organization.save(update_fields=["is_active"])
        AuditLog.objects.create(
            actor=request.user,
            action="club_reactivated" if is_active else "club_suspended",
            target=organization.name,
        )
    return Response(OrganizationAdminSerializer(organization).data)


@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_users(request):
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


@api_view(["PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsSuperAdmin])
def superadmin_user_detail(request, user_id):
    unknown_fields = set(request.data) - {"role", "club_id"}
    if unknown_fields:
        return Response(
            {"detail": "Only role and club_id may be changed."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer = SuperadminUserUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    target = User.objects.filter(pk=user_id).first()
    if target is None:
        return Response({"detail": "User not found."}, status=404)

    validated_data = serializer.validated_data
    new_role = validated_data.get("role", target.role)
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
        if "role" in validated_data:
            target.role = new_role
            target.save(update_fields=["role"])
            if old_role != new_role:
                AuditLog.objects.create(
                    actor=request.user,
                    action="role_changed",
                    target=f"{target.username}: {old_role} -> {new_role}",
                )

        if new_role != User.Role.BOARD_MEMBER and assignment is not None:
            old_club_name = assignment.club.name
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
                old_club_name = assignment.club.name
                assignment.club = new_club
                assignment.save(update_fields=["club"])
                AuditLog.objects.create(
                    actor=request.user,
                    action="board_assignment_changed",
                    target=f"{target.username}: {old_club_name} -> {new_club.name}",
                )

    return Response(SuperadminUserSerializer(target).data)


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
