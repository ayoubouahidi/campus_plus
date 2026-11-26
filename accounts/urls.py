from django.urls import path

from .views import email_password_login, logout, me, me_avatar
from .avatar_views import auth_sync_preserving_avatar, me_avatar_with_cleanup


urlpatterns = [
    path("auth/sync", auth_sync_preserving_avatar, name="auth-sync"),
    path("api/auth/login/", email_password_login, name="email-password-login"),
    path("api/me/", me, name="me"),
    path("api/me/avatar/", me_avatar_with_cleanup, name="me-avatar"),
    path("api/auth/logout/", logout, name="logout"),
]
