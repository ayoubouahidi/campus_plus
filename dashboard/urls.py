from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementViewSet,
    board_club_settings,
    board_members,
    board_registrations_weekly,
    board_requests,
    board_stats,
    decide_request,
    superadmin_audit_log,
    superadmin_events_weekly,
    superadmin_organization_detail,
    superadmin_organizations,
    superadmin_role_distribution,
    superadmin_stats,
    superadmin_user_detail,
    superadmin_users,
)


router = DefaultRouter()
router.register("announcements", AnnouncementViewSet, basename="board-announcement")

urlpatterns = [
    path("api/board/club/", board_club_settings),
    path("api/board/stats/", board_stats),
    path("api/board/registrations/weekly/", board_registrations_weekly),
    path("api/board/members/", board_members),
    path("api/board/requests/", board_requests),
    path(
        "api/board/requests/<int:request_id>/<str:decision>/",
        decide_request,
    ),
    path("api/board/", include(router.urls)),
    path("api/superadmin/stats/", superadmin_stats),
    path("api/superadmin/organizations/", superadmin_organizations),
    path(
        "api/superadmin/organizations/<int:organization_id>/",
        superadmin_organization_detail,
    ),
    path("api/superadmin/users/", superadmin_users),
    path("api/superadmin/users/<int:user_id>/", superadmin_user_detail),
    path("api/superadmin/roles/distribution/", superadmin_role_distribution),
    path("api/superadmin/events/weekly/", superadmin_events_weekly),
    path("api/superadmin/audit-log/", superadmin_audit_log),
]
