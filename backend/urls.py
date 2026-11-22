"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

# [ahmed] Add the OpenAPI schema and Swagger views.
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from core_data.views import (
    ClubEventViewSet,
    ClubViewSet,
    DepartmentViewSet,
    UserMemberViewSet,
    signup,
)
from backend.views import HealthLiveView, HealthView
from realtime.views import RealtimeTokenView


router = DefaultRouter()

router.register(
    "club-events",
    ClubEventViewSet,
    basename="club-event",
)

router.register(
    "departments",
    DepartmentViewSet,
    basename="department",
)

router.register(
    "members",
    UserMemberViewSet,
    basename="member",
)

router.register(
    "clubs",
    ClubViewSet,
    basename="club",
)


urlpatterns = [
    path("admin/", admin.site.urls),

    path("", include("accounts.urls")),
    path("", include("dashboard.urls")),

    # [ahmed] Public liveness probes; neither endpoint touches external services.
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/health/live", HealthLiveView.as_view(), name="health-live"),

    path(
        "api/realtime/token/",
        RealtimeTokenView.as_view(),
        name="realtime-token",
    ),

    path("api/", include(router.urls)),

    path(
        "api/signup/",
        signup,
        name="signup",
    ),

    # [ahmed] Expose the generated OpenAPI schema.
    path(
        "api/schema/",
        SpectacularAPIView.as_view(),
        name="schema",
    ),

    # [ahmed] Expose Swagger UI for API documentation.
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema",
        ),
        name="swagger-ui",
    ),
]
