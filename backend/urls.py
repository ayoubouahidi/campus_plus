from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core_data.views import (
    ClubEventViewSet,
    ClubViewSet,
    DepartmentViewSet,
    UserMemberViewSet,
    resend_signup_verification,
    verify_signup,
)
from core_data.secure_signup import secure_signup
from backend.views import HealthLiveView, HealthView
from realtime.views import RealtimeTokenView
from notifications.views import NotificationViewSet

router = DefaultRouter()
router.register("club-events", ClubEventViewSet, basename="club-event")
router.register("departments", DepartmentViewSet, basename="department")
router.register("members", UserMemberViewSet, basename="member")
router.register("clubs", ClubViewSet, basename="club")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("accounts.urls")),
    path("", include("dashboard.urls")),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/health/live", HealthLiveView.as_view(), name="health-live"),
    path("api/realtime/token/", RealtimeTokenView.as_view(), name="realtime-token"),
    path("api/", include(router.urls)),
    path("api/signup/", secure_signup, name="signup"),
    path("api/signup/verify/", verify_signup, name="signup-verify"),
    path("api/signup/resend/", resend_signup_verification, name="signup-verification-resend"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
