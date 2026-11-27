from datetime import timedelta
import secrets

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core import mail
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import EmailVerification
from core_data.models import Department
from core_data.views import (
    SIGNUP_CODE_LIFETIME,
    VALIDATION_ERROR_RESPONSE,
    EmailDeliveryFailed,
    send_signup_verification,
)

User = get_user_model()


class SecureSignupSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    year_of_study = serializers.IntegerField(min_value=1, max_value=7)
    department_id = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized


@extend_schema(
    summary="Email signup",
    description=(
        "Starts an email signup and sends a six-digit verification code. "
        "The account is created only after POST /api/signup/verify/."
    ),
    request=SecureSignupSerializer,
    responses={
        202: inline_serializer(
            name="SecureSignupPendingResponse",
            fields={
                "detail": serializers.CharField(read_only=True),
                "email": serializers.EmailField(read_only=True),
                "verification_required": serializers.BooleanField(read_only=True),
            },
        ),
        400: VALIDATION_ERROR_RESPONSE,
        503: OpenApiResponse(description="The verification email could not be sent."),
    },
    auth=[],
)
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def secure_signup(request):
    """Start email verification without accepting client-supplied club assignment."""
    serializer = SecureSignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    identity = serializer.validated_data
    email = identity["email"]
    if User.objects.filter(email__iexact=email).exists():
        return Response(
            {"email": "An account with this email already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    code = f"{secrets.randbelow(900_000) + 100_000:06d}"
    registration_data = {
        "password_hash": make_password(identity["password"]),
        "first_name": identity["first_name"],
        "last_name": identity["last_name"],
        "year_of_study": identity["year_of_study"],
        "department_id": identity["department_id"].pk,
        # club_id is deliberately absent; signup cannot self-assign club membership.
    }
    try:
        with transaction.atomic():
            existing = EmailVerification.objects.select_for_update().filter(email=email).first()
            if existing is not None and existing.updated_at > now - timedelta(seconds=60):
                return Response(
                    {
                        "detail": "If signup is pending for this address, a verification code has been sent.",
                        "email": email,
                        "verification_required": True,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )
            EmailVerification.objects.update_or_create(
                email=email,
                defaults={
                    "code_hash": make_password(code),
                    "registration_data": registration_data,
                    "attempts": 0,
                    "expires_at": now + SIGNUP_CODE_LIFETIME,
                },
            )
            send_signup_verification(email, code)
    except EmailDeliveryFailed:
        return Response(
            {"detail": "The verification email could not be sent. Please retry."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(
        {
            "detail": "A verification code has been sent to your email.",
            "email": email,
            "verification_required": True,
        },
        status=status.HTTP_202_ACCEPTED,
    )
