import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Environment & Security ---
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# --- Core Infra & Static Services ---
INSTALLED_APPS = [
    "django.contrib.staticfiles",  # Needed for collectstatic to serve assets via NGINX
    "channels",                    # ASGI & WebSocket integration
]

# --- Redis Pub/Sub Broker (Channels Layer) ---
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(os.getenv("REDIS_HOST", "redis"), 6379)],
        },
    },
}

ROOT_URLCONF = "config.urls"

# --- Database Connection (PostgreSQL 16) ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "campus_plus"),
        "USER": os.getenv("POSTGRES_USER", "campus_user"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

# --- Reverse Proxy & SSL Security Handshake ---
CSRF_TRUSTED_ORIGINS = [
    "https://localhost",
    "https://127.0.0.1",
]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- ASGI Application Server ---
ASGI_APPLICATION = "config.asgi.application"

# --- Static & Media Volumes (Mounted to NGINX) ---
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"