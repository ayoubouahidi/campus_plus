from django.contrib import admin
from django.urls import path
from .views import health_check, check_real_ip
from drf_spectacular.views import SpectacularAPIView
from drf_spectacular.views import SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check),
    path("api/check-ip/", check_real_ip),
    path("api/schema/", SpectacularAPIView.as_view()),
    path("api/docs/", SpectacularSwaggerView.as_view(url="/api/schema/")),
]
