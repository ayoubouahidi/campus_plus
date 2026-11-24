import hmac
import os
import uuid
from io import BytesIO

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image, ImageOps
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

from core_data.models import ALLOWED_IMAGE_FORMATS, UserMember
from core_data.models import validate_file_size, validate_image_content
from dashboard.models import AuditLog
from .serializers import (
    AuthSyncSerializer,
    EmailPasswordLoginSerializer,
    UserPhoneSerializer,
    UserSerializer,
)


User = get_user_model()


def save_user_with_email_conflict_check(user, email):
    try:
        with transaction.atomic():
            user.save()
    except IntegrityError:
        matches = User.objects.filter(email__iexact=email)
        if user.pk is not None:
            matches = matches.exclude(pk=user.pk)
        if matches.exists():
            return False
        raise
    return True


def get_campus_allow_list():
    raw = settings.ALLOWED_42_CAMPUSES
    return {
        normalize_campus_name(value)
        for value in raw.split(",")
        if value.strip()
    }


def normalize_campus_name(value):
    normalized = " ".join(value.casefold().split())
    return normalized[5:] if normalized.startswith("1337 ") else normalized


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def email_password_login(request):
    serializer = EmailPasswordLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].strip()
    password = serializer.validated_data["password"]
    matching_users = list(User.objects.filter(email__iexact=email)[:2])

    if len(matching_users) != 1:
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    user = authenticate(
        request,
        username=matching_users[0].get_username(),
        password=password,
    )
    if user is None:
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    token, _ = Token.objects.get_or_create(user=user)
    AuditLog.objects.create(
        actor=user,
        action="login",
        target=user.username,
    )
    return Response({"token": token.key, "user": UserSerializer(user).data})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_sync(request):
    supplied_key = request.headers.get("x-internal-key", "")
    expected_key = getattr(settings, "BACKEND_INTERNAL_KEY", "")
    if not expected_key or not hmac.compare_digest(supplied_key, expected_key):
        return Response({"detail": "Invalid internal key."}, status=status.HTTP_403_FORBIDDEN)

    serializer = AuthSyncSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    identity = serializer.validated_data
    forty_two_id = identity["fortyTwoId"]
    login = identity["login"]
    email = identity["email"].strip().lower()

    campus = identity.get("campus", "")
    allowed_campuses = get_campus_allow_list()
    if (
        not allowed_campuses
        or normalize_campus_name(campus) not in allowed_campuses
    ):
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
        if user is not None and not user.is_active:
            return Response(
                {"detail": "This account is inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )
        matching_email = User.objects.filter(email__iexact=email)
        if user is not None:
            matching_email = matching_email.exclude(pk=user.pk)
        if matching_email.exists():
            return Response(
                {"email": "This email is already linked to another account."},
                status=status.HTTP_409_CONFLICT,
            )
        if user is None:
            user = User(
                username=login,
                first_name=identity.get("firstName", ""),
                last_name=identity.get("lastName", ""),
                email=email,
                forty_two_id=forty_two_id,
                role=(
                    "SUPERADMIN"
                    if login in superadmin_logins
                    else "STUDENT"
                ),
                campus=campus,
                avatar_url=identity.get("imageUrl") or "",
            )
            user.set_unusable_password()
            if not save_user_with_email_conflict_check(user, email):
                return Response(
                    {"email": "This email is already linked to another account."},
                    status=status.HTTP_409_CONFLICT,
                )
        else:
            user.username = login
            user.first_name = identity.get("firstName", "")
            user.last_name = identity.get("lastName", "")
            user.email = email
            user.campus = campus
            user.avatar_url = identity.get("imageUrl") or ""
            if not save_user_with_email_conflict_check(user, email):
                return Response(
                    {"email": "This email is already linked to another account."},
                    status=status.HTTP_409_CONFLICT,
                )

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


@api_view(["POST", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me_avatar(request):
    member = UserMember.objects.filter(user=request.user).first()

    if request.method == "DELETE":
        if member and member.image_path:
            member.image_path.delete(save=False)
            member.image_path = ""
            member.save(update_fields=["image_path"])
            request.user.avatar_url = ""
            request.user.save(update_fields=["avatar_url"])
        return Response(UserSerializer(request.user).data)

    image = request.FILES.get("file")
    if image is None:
        return Response({"file": ["This field is required."]}, status=400)
    try:
        validate_file_size(image)
        validate_image_content(image)
    except (
        ValidationError,
        SyntaxError,
        OSError,
        EOFError,
        Image.DecompressionBombError,
    ) as error:
        messages = (
            error.messages
            if isinstance(error, ValidationError)
            else ["The uploaded file is not a valid image."]
        )
        return Response({"file": messages}, status=400)

    with Image.open(image) as opened_image:
        image_format = opened_image.format
        prepared_image = ImageOps.exif_transpose(opened_image)
        prepared_image.thumbnail((512, 512))
        if image_format == "JPEG" and prepared_image.mode not in ("RGB", "L"):
            prepared_image = prepared_image.convert("RGB")
        prepared_image.info.pop("exif", None)
        output = BytesIO()
        prepared_image.save(output, format=image_format, optimize=True)
    extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}[image_format]
    normalized_image = SimpleUploadedFile(
        f"{uuid.uuid4().hex}{extension}",
        output.getvalue(),
        content_type=ALLOWED_IMAGE_FORMATS[image_format],
    )

    if member is None:
        member = UserMember.objects.create(
            user=request.user,
            username=request.user.get_username(),
        )
    member.image_path = normalized_image
    member.save(update_fields=["image_path"])
    public_media_base_url = settings.DJANGO_PUBLIC_MEDIA_BASE_URL
    request.user.avatar_url = (
        f"{public_media_base_url}{member.image_path.url}"
        if public_media_base_url
        else request.build_absolute_uri(member.image_path.url)
    )
    request.user.save(update_fields=["avatar_url"])
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
