from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CampusUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "Campus Hub",
            {
                "fields": (
                    "forty_two_id",
                    "role",
                    "campus",
                    "avatar_url",
                    "phone",
                )
            },
        ),
    )
