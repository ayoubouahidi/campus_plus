from django.urls import path

from .views import auth_sync, email_password_login, logout, me


urlpatterns = [
    path("auth/sync", auth_sync, name="auth-sync"),
    path("api/auth/login/", email_password_login, name="email-password-login"),
    path("api/me/", me, name="me"),
    path("api/auth/logout/", logout, name="logout"),
]
