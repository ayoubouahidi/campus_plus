import hmac
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core_data.models import UserMember
from dashboard.models import AuditLog
from .serializers import UserPhoneSerializer, UserSerializer


User = get_user_model()


def get_campus_allow_list():
    raw = os.getenv("ALLOWED_42_CAMPUSES", "")
    return {value.strip().lower() for value in raw.split(",") if value.strip()}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_sync(request):
    supplied_key = request.headers.get("x-internal-key", "")
    expected_key = getattr(settings, "BACKEND_INTERNAL_KEY", "")
    if not expected_key or not hmac.compare_digest(supplied_key, expected_key):
        return Response({"detail": "Invalid internal key."}, status=status.HTTP_403_FORBIDDEN)

    forty_two_id = request.data.get("fortyTwoId")
    login = request.data.get("login")
    if not forty_two_id or not login:
        return Response(
            {"detail": "fortyTwoId and login are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    campus = request.data.get("campus") or ""
    allowed_campuses = get_campus_allow_list()
    if allowed_campuses and campus.lower() not in allowed_campuses:
        return Response(
            {"detail": "This campus is not allowed."},
            status=status.HTTP_403_FORBIDDEN,
        )

    superadmin_logins = {
        value.strip()
        for value in os.getenv("SUPERADMIN_LOGINS", "").split(",")
        if value.strip()
    }

    with transaction.atomic():
        user = User.objects.filter(forty_two_id=forty_two_id).first()
        if user is None:
            user = User(
                username=login,
                first_name=request.data.get("firstName", ""),
                last_name=request.data.get("lastName", ""),
                email=request.data.get("email", ""),
                forty_two_id=forty_two_id,
                role=(
                    "SUPERADMIN"
                    if login in superadmin_logins
                    else "STUDENT"
                ),
                campus=campus,
                avatar_url=request.data.get("imageUrl") or "",
            )
            user.set_unusable_password()
            user.save()
        else:
            user.username = login
            user.first_name = request.data.get("firstName", "")
            user.last_name = request.data.get("lastName", "")
            user.email = request.data.get("email", "")
            user.campus = campus
            user.avatar_url = request.data.get("imageUrl") or ""
            user.save()

        member, _ = UserMember.objects.get_or_create(
            user=user,
            defaults={"username": login},
        )
        member.username = login
        member.first_name = user.first_name
        member.last_name = user.last_name
        member.save()

        AuditLog.objects.create(
            actor=user,
            action="login",
            target=user.username,
        )
        token, _ = Token.objects.get_or_create(user=user)

    return Response(
        {"token": token.key, "user": UserSerializer(user).data},
        status=status.HTTP_200_OK,
    )


@api_view(["GET", "PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "PATCH":
        serializer = UserPhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.phone = serializer.validated_data["phone"]
        request.user.save(update_fields=["phone"])
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
