from rest_framework import serializers

from core_data.serializers import absolute_file_url

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist

from accounts.models import ClubBoardAssignment
from core_data.models import Club
from .models import Announcement, AuditLog, MembershipRequest

User = get_user_model()


class ClubImagesMixin(serializers.Serializer):
    """Logo and banner: upload with `logo`/`banner` (multipart), read `logo_url`/`banner_url`."""

    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    def get_logo_url(self, club) -> str | None:
        return absolute_file_url(club.logo, self.context, None)

    def get_banner_url(self, club) -> str | None:
        return absolute_file_url(club.banner, self.context, None)


class ClubPresidentMixin(serializers.Serializer):
    """The club's president (contact shown to signed-in students): a member of its board team."""

    president = serializers.SerializerMethodField()

    def get_president(self, club) -> dict | None:
        head = club.head
        if head is None or head.user is None:
            return None
        user = head.user
        return {
            "id": user.pk,
            "name": user.get_full_name() or user.username,
            "email": user.email,
            "phone": head.phone or user.phone,
        }


CLUB_IMAGE_KWARGS = {
    "logo": {"write_only": True, "required": False},
    "banner": {"write_only": True, "required": False},
}


class BoardClubSettingsSerializer(ClubPresidentMixin, ClubImagesMixin, serializers.ModelSerializer):
    department_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Club
        fields = [
            "id",
            "department_id",
            "slug",
            "category",
            "name",
            "description",
            "contact_email",
            "meeting_day",
            "meeting_time",
            "meeting_location",
            "logo",
            "banner",
            "logo_url",
            "banner_url",
            "president",
        ]
        # The category is chosen by a super admin (Organizations), not by the board.
        read_only_fields = ["slug", "category"]
        extra_kwargs = CLUB_IMAGE_KWARGS


class BoardTeamMemberSerializer(serializers.ModelSerializer):
    """A member of a club's board team (club membership exists only for board members)."""

    name = serializers.SerializerMethodField()
    joined_date = serializers.DateTimeField(source="date_joined", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "joined_date", "status"]
        read_only_fields = fields

    def get_name(self, obj) -> str:
        return obj.get_full_name() or obj.username

    def get_status(self, obj) -> str:
        return "active" if obj.is_active else "inactive"


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ["id", "club", "title", "message", "created_by", "created_at"]
        read_only_fields = ["id", "club", "created_by", "created_at"]


class MembershipRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.username", read_only=True)

    class Meta:
        model = MembershipRequest
        fields = [
            "id",
            "member",
            "member_name",
            "kind",
            "note",
            "status",
            "created_at",
            "decided_by",
            "decided_at",
        ]
        read_only_fields = [
            "id",
            "member",
            "status",
            "created_at",
            "decided_by",
            "decided_at",
        ]


class OrganizationAdminSerializer(ClubPresidentMixin, ClubImagesMixin, serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.title", read_only=True)

    class Meta:
        model = Club
        fields = [
            "id",
            "name",
            "department",
            "department_name",
            "category",
            "is_active",
            "logo",
            "banner",
            "logo_url",
            "banner_url",
            "president",
        ]
        extra_kwargs = CLUB_IMAGE_KWARGS


class SuperadminUserSerializer(serializers.ModelSerializer):
    club_id = serializers.SerializerMethodField()
    club_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "club_id",
            "club_name",
        ]
        read_only_fields = fields

    def get_club_id(self, obj) -> int | None:
        try:
            return obj.board_assignment.club_id
        except ObjectDoesNotExist:
            return None

    def get_club_name(self, obj) -> str | None:
        try:
            club = obj.board_assignment.club
        except ObjectDoesNotExist:
            return None
        return club.name


class SuperadminUserUpdateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    role = serializers.ChoiceField(
        choices=User.Role.choices,
        required=False,
    )
    club_id = serializers.PrimaryKeyRelatedField(
        queryset=Club.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_username(self, value):
        matches = User.objects.filter(username__iexact=value)
        if self.instance is not None:
            matches = matches.exclude(pk=self.instance.pk)
        if matches.exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        matches = User.objects.filter(email__iexact=normalized_email)
        if self.instance is not None:
            matches = matches.exclude(pk=self.instance.pk)
        if matches.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized_email

    def validate(self, attrs):
        role = attrs.get("role", getattr(self.instance, "role", User.Role.STUDENT))
        assignment = None
        if self.instance is not None:
            assignment = (
                ClubBoardAssignment.objects.filter(user=self.instance)
                .select_related("club")
                .first()
            )
        current_club = assignment.club if assignment else None
        club = attrs.get("club_id", current_club)
        if role == User.Role.BOARD_MEMBER and club is None:
            raise serializers.ValidationError(
                {"club_id": "A board member must be assigned to an organization."}
            )
        if (
            role != User.Role.BOARD_MEMBER
            and attrs.get("club_id") is not None
        ):
            raise serializers.ValidationError(
                {"club_id": "Only board members may be assigned to an organization."}
            )
        return attrs


class SuperadminUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=User.Role.choices,
        default=User.Role.STUDENT,
    )
    is_active = serializers.BooleanField(default=True)
    club_id = serializers.PrimaryKeyRelatedField(
        queryset=Club.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized_email

    def validate(self, attrs):
        role = attrs.get("role", User.Role.STUDENT)
        club = attrs.get("club_id")
        if role == User.Role.BOARD_MEMBER and club is None:
            raise serializers.ValidationError(
                {"club_id": "A board member must be assigned to an organization."}
            )
        if role != User.Role.BOARD_MEMBER and club is not None:
            raise serializers.ValidationError(
                {"club_id": "Only board members may be assigned to an organization."}
            )
        return attrs

    def create(self, validated_data):
        club = validated_data.pop("club_id", None)
        user = User.objects.create_user(**validated_data)
        if club is not None:
            ClubBoardAssignment.objects.create(user=user, club=club)
        return user

class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "actor_username", "action", "target", "created_at"]


class BoardStatsSerializer(serializers.Serializer):
    total_events = serializers.IntegerField()
    active_members = serializers.IntegerField()
    pending_requests = serializers.IntegerField()
    events_this_month = serializers.IntegerField()
    registrations_this_month = serializers.IntegerField(allow_null=True)
    registrations_last_month = serializers.IntegerField(allow_null=True)


class RegistrationWeekSerializer(serializers.Serializer):
    date = serializers.DateField()
    registrations = serializers.IntegerField()


class SuperadminStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    total_clubs = serializers.IntegerField()
    events_this_month = serializers.IntegerField()
    pending_requests = serializers.IntegerField()


class RoleDistributionSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices)
    count = serializers.IntegerField()


class EventWeekSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    events = serializers.IntegerField()


class PaginatedOrganizationSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = OrganizationAdminSerializer(many=True)


class PaginatedSuperadminUserSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = SuperadminUserSerializer(many=True)


class PaginatedAuditLogSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = AuditLogSerializer(many=True)
