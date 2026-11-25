from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    event_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "event_title",
            "is_read",
            "created_at",
            "read_at",
            "event_id",
        ]
        read_only_fields = fields


class UnreadCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField(min_value=0, read_only=True)


class MarkAllReadSerializer(UnreadCountSerializer):
    updated_count = serializers.IntegerField(min_value=0, read_only=True)
