from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementViewSet,
    board_members,
    board_registrations_weekly,
    board_requests,
    board_stats,
    decide_request,
    join_club,
)


router = DefaultRouter()
router.register("announcements", AnnouncementViewSet, basename="board-announcement")

urlpatterns = [
    path("api/board/stats/", board_stats),
    path("api/board/registrations/weekly/", board_registrations_weekly),
    path("api/board/members/", board_members),
    path("api/board/requests/", board_requests),
    path(
        "api/board/requests/<int:request_id>/<str:decision>/",
        decide_request,
    ),
    path("api/board/", include(router.urls)),
    path("api/clubs/<slug:slug>/join/", join_club),
]
