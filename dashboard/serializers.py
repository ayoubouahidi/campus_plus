from rest_framework import serializers

from core_data.models import UserMember
from .models import Announcement, MembershipRequest


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
        return "active" if not obj.user or obj.user.is_active else "inactive"
