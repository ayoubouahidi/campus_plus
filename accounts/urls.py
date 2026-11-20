from django.urls import path

from .views import auth_sync, logout, me


urlpatterns = [
    path("auth/sync", auth_sync, name="auth-sync"),
    path("api/me/", me, name="me"),
    path("api/auth/logout/", logout, name="logout"),
]
