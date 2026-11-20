from rest_framework.permissions import BasePermission


def user_club_id(user):
    if not user or not user.is_authenticated:
        return None

    try:
        member = user.usermember
    except AttributeError:
        return None
    if member.club_id_id:
        return member.club_id_id
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
        if (
            getattr(user, "role", None) in {"SUPERADMIN", "BOARD_MEMBER"}
            or user.is_superuser
        ):
            return True
        try:
            return user.usermember.headed_clubs.exists()
        except AttributeError:
            return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        if getattr(user, "role", None) == "SUPERADMIN" or user.is_superuser:
            return True

        head = getattr(obj, "head", None)
        if head and head.user_id == user.pk:
            return True

        if hasattr(obj, "head"):
            club_id = obj.pk
        else:
            club_id = getattr(obj, "club_id_id", None)
        if club_id is None:
            club_id = getattr(obj, "club_id", None)
        if club_id is None:
            club_id = getattr(getattr(obj, "club", None), "pk", None)
        return bool(club_id and user_club_id(user) == club_id)
