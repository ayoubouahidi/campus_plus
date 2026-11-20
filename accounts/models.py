from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        BOARD_MEMBER = "BOARD_MEMBER", "Board member"
        SUPERADMIN = "SUPERADMIN", "Superadmin"

    forty_two_id = models.PositiveIntegerField(unique=True, null=True, blank=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
    )
    campus = models.CharField(max_length=100, blank=True)
    avatar_url = models.URLField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
