from django.apps import apps
from django.core.exceptions import FieldDoesNotExist
from django.db.models import Count
from django.utils.text import slugify
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from accounts.permissions import IsClubBoard, user_club_id
from core_data.models import Club, ClubEvent, UserMember
from .models import Announcement, AuditLog, MembershipRequest
from .serializers import (
    AnnouncementSerializer,
    BoardMemberSerializer,
    MembershipRequestSerializer,
)


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
