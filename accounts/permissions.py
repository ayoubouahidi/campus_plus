from django.core.exceptions import ObjectDoesNotExist
from rest_framework.permissions import BasePermission

from .models import ClubBoardAssignment


def user_club_id(user):
    if not user or not user.is_authenticated:
        return None

    if getattr(user, "role", None) == "BOARD_MEMBER":
        assignment = ClubBoardAssignment.objects.filter(user=user).values_list(
            "club_id",
            flat=True,
        ).first()
        if assignment is not None:
            return assignment

    try:
        member = user.usermember
    except (AttributeError, ObjectDoesNotExist):
        return None
    return member.headed_clubs.order_by("pk").values_list("pk", flat=True).first()


class IsSuperAdmin(BasePermission):
    message = "Superadmin access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                getattr(user, "role", None) == "SUPERADMIN"
                or user.is_superuser
            )
        )


class IsClubBoard(BasePermission):
    message = "You must be a board member of this club."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "role", None) == "SUPERADMIN" or user.is_superuser:
            return True

        if getattr(user, "role", None) == "BOARD_MEMBER":
            return ClubBoardAssignment.objects.filter(user=user).exists()

        try:
            return user.usermember.headed_clubs.exists()
        except (AttributeError, ObjectDoesNotExist):
            return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        if getattr(user, "role", None) == "SUPERADMIN" or user.is_superuser:
            return True

        head = getattr(obj, "head", None)
        if head and head.user_id == user.pk:
            return True

        if getattr(user, "role", None) != "BOARD_MEMBER":
            return False

        if hasattr(obj, "head"):
            club_id = obj.pk
        else:
            club_id = getattr(obj, "club_id_id", None)
        if club_id is None:
            club_id = getattr(obj, "club_id", None)
        if club_id is None:
            club_id = getattr(getattr(obj, "club", None), "pk", None)
        return bool(club_id and user_club_id(user) == club_id)
