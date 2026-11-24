from rest_framework import serializers

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist

from accounts.models import ClubBoardAssignment
from core_data.models import Club, UserMember
from .models import Announcement, AuditLog, MembershipRequest

User = get_user_model()


class BoardClubSettingsSerializer(serializers.ModelSerializer):
    department_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Club
        fields = [
            "id",
            "department_id",
            "name",
            "description",
            "contact_email",
            "meeting_day",
            "meeting_time",
            "meeting_location",
        ]


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


class BoardMemberSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    role = serializers.CharField(source="user.role", read_only=True)
    joined_date = serializers.DateTimeField(source="user.date_joined", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = UserMember
        fields = ["id", "name", "role", "joined_date", "status"]

    def get_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return obj.username

    def get_status(self, obj):
        return "active" if obj.user and obj.user.is_active else "inactive"


class OrganizationAdminSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.title", read_only=True)

    class Meta:
        model = Club
        fields = ["id", "name", "department", "department_name", "is_active"]


class OrganizationStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


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

    def get_club_id(self, obj):
        try:
            return obj.board_assignment.club_id
        except ObjectDoesNotExist:
            return None

    def get_club_name(self, obj):
        try:
            club = obj.board_assignment.club
        except ObjectDoesNotExist:
            return None
        return club.name


class SuperadminUserUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=User.Role.choices,
        required=False,
    )
    club_id = serializers.PrimaryKeyRelatedField(
        queryset=Club.objects.all(),
        required=False,
        allow_null=True,
    )


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "actor_username", "action", "target", "created_at"]
