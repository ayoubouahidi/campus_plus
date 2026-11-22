import hmac
import os

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction
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
from drf_spectacular.utils import OpenApiResponse, extend_schema

from core_data.models import UserMember
from core_data.phone_reconciliation import PhonePairState, classify_phone_pair
from dashboard.models import AuditLog
from .serializers import (
    AuthSyncSerializer,
    AuthResponseSerializer,
    DetailResponseSerializer,
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
    raw = os.getenv("ALLOWED_42_CAMPUSES", "")
    return {value.strip().lower() for value in raw.split(",") if value.strip()}


@extend_schema(
    request=EmailPasswordLoginSerializer,
    responses={
        200: AuthResponseSerializer,
        400: DetailResponseSerializer,
        401: DetailResponseSerializer,
    },
)
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


@extend_schema(
    methods=["GET"],
    responses={200: UserSerializer, 401: DetailResponseSerializer},
)
@extend_schema(
    methods=["PATCH"],
    request=UserPhoneSerializer,
    responses={
        200: UserSerializer,
        400: DetailResponseSerializer,
        401: DetailResponseSerializer,
        409: DetailResponseSerializer,
    },
)
@api_view(["GET", "PATCH"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "PATCH":
        serializer = UserPhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested_phone = serializer.validated_data["phone"]
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            member = (
                UserMember.objects.select_for_update()
                .filter(user=user)
                .first()
            )
            phone_state = classify_phone_pair(
                user.phone,
                member.phone if member is not None else None,
                member_exists=member is not None,
            )
            if phone_state in {
                PhonePairState.ACCOUNT_ONLY,
                PhonePairState.CONFLICT,
                PhonePairState.ACCOUNT_WITHOUT_MEMBER,
            }:
                return Response(
                    {
                        "phone": (
                            "Existing phone data must be reconciled before it "
                            "can be updated."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if member is None:
                member = UserMember.objects.create(
                    user=user,
                    username=user.username,
                )
            member.phone = requested_phone
            member.save(update_fields=["phone"])
            # Keep the temporary accounts field synchronized for clients that
            # still read it, while UserMember remains the canonical owner.
            user.phone = requested_phone
            user.save(update_fields=["phone"])
            request.user = user
    return Response(UserSerializer(request.user).data)


@extend_schema(
    request=None,
    responses={
        204: OpenApiResponse(description="Authentication token revoked."),
        401: DetailResponseSerializer,
    },
)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
