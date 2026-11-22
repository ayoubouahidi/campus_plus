from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .delivery import deliver_unread_count
from .models import Notification
from .serializers import (
    MarkAllReadSerializer,
    NotificationSerializer,
    UnreadCountSerializer,
)


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_page_size(self, request):
        values = request.query_params.getlist(self.page_size_query_param)
        if not values:
            return self.page_size
        if len(values) != 1:
            raise ValidationError({"page_size": "Provide this parameter once."})
        try:
            value = int(values[0])
        except (TypeError, ValueError):
            value = 0
        if not 1 <= value <= self.max_page_size:
            raise ValidationError({"page_size": "Use an integer from 1 to 100."})
        return value


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Notification.objects.none()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        queryset = Notification.objects.filter(
            recipient=self.request.user,
        ).select_related("event")
        values = (
            self.request.query_params.getlist("unread")
            if self.action == "list"
            else []
        )
        if values:
            if len(values) != 1 or values[0].lower() not in {"true", "false"}:
                raise ValidationError({"unread": "Use true or false once."})
            queryset = queryset.filter(is_read=values[0].lower() == "false")
        return queryset

    @extend_schema(
        parameters=[OpenApiParameter("unread", bool, description="Filter by unread/read state.")],
        responses={
            200: NotificationSerializer(many=True),
            400: OpenApiResponse(description="Invalid filter or pagination value."),
            401: OpenApiResponse(description="Authentication required."),
        },
        description="Lists only the authenticated user's persistent notifications, newest first.",
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        request=None,
        responses={
            200: UnreadCountSerializer,
            401: OpenApiResponse(description="Authentication required."),
        },
    )
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).count()
        return Response({"unread_count": count})

    @extend_schema(
        request=None,
        responses={
            200: NotificationSerializer,
            401: OpenApiResponse(description="Authentication required."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])
        unread_count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        transaction.on_commit(
            lambda: deliver_unread_count(request.user.pk, unread_count),
            robust=True,
        )
        return Response(self.get_serializer(notification).data)

    @extend_schema(
        request=None,
        responses={
            200: MarkAllReadSerializer,
            401: OpenApiResponse(description="Authentication required."),
        },
    )
    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read(self, request):
        now = timezone.now()
        updated = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True, read_at=now)
        transaction.on_commit(
            lambda: deliver_unread_count(request.user.pk, 0),
            robust=True,
        )
        return Response({"updated_count": updated, "unread_count": 0}, status=status.HTTP_200_OK)
