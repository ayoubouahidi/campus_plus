from django.contrib.auth import get_user_model
from django.db import transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated

from core_data.models import UserMember
from .serializers import (
    AuthResponseSerializer,
    AuthSyncSerializer,
    AvatarUploadSerializer,
    DetailResponseSerializer,
    UserSerializer,
)
from .views import auth_sync, me_avatar

User = get_user_model()


@extend_schema(
    request=AuthSyncSerializer,
    responses={
        200: AuthResponseSerializer,
        400: DetailResponseSerializer,
        403: DetailResponseSerializer,
        409: DetailResponseSerializer,
    },
)
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_sync_preserving_avatar(request):
    """Keep uploaded avatars when the 42 provider refreshes its profile data."""
    # Cache the raw body before reading request.data, so the wrapped view can
    # parse the same body again from the plain Django request.
    django_request = request._request
    django_request.body
    forty_two_id = request.data.get("fortyTwoId")
    try:
        forty_two_id = int(forty_two_id)
    except (TypeError, ValueError):
        return auth_sync(django_request)

    with transaction.atomic():
        existing = (
            User.objects.select_for_update()
            .filter(forty_two_id=forty_two_id)
            .first()
        )
        custom_avatar = bool(existing and existing.avatar_is_custom)
        existing_avatar_url = existing.avatar_url if custom_avatar else ""
        response = auth_sync(django_request)
        if response.status_code < 400 and custom_avatar:
            existing.refresh_from_db()
            existing.avatar_url = existing_avatar_url
            existing.avatar_is_custom = True
            existing.save(update_fields=["avatar_url", "avatar_is_custom"])
            response.data["user"]["avatar_url"] = existing_avatar_url
        return response


@extend_schema(
    methods=["POST"],
    request=AvatarUploadSerializer,
    responses={
        200: UserSerializer,
        400: OpenApiResponse(description="The uploaded image is invalid."),
    },
)
@extend_schema(methods=["DELETE"], request=None, responses={200: UserSerializer})
@api_view(["POST", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me_avatar_with_cleanup(request):
    """Mark uploads as custom and remove replaced files after a successful save."""
    member = UserMember.objects.filter(user=request.user).first()
    old_name = member.image_path.name if member and member.image_path else ""
    storage = member.image_path.storage if member and member.image_path else None

    with transaction.atomic():
        # Pass the plain Django request: the wrapped DRF view builds its own
        # Request and parses the upload itself (request.data is not read here).
        response = me_avatar(request._request)
        if response.status_code >= 400:
            return response

        user = User.objects.select_for_update().get(pk=request.user.pk)
        if request.method == "DELETE":
            user.avatar_is_custom = False
            user.save(update_fields=["avatar_is_custom"])
            return response

        replacement = UserMember.objects.filter(user=user).first()
        new_name = replacement.image_path.name if replacement and replacement.image_path else ""
        user.avatar_is_custom = bool(new_name)
        user.save(update_fields=["avatar_is_custom"])

        if old_name and old_name != new_name and storage is not None:
            transaction.on_commit(lambda: storage.delete(old_name))
        return response
