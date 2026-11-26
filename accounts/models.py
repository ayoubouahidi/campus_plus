from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


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

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                condition=~Q(email=""),
                name="accounts_user_email_ci_unique",
            ),
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)


class ClubBoardAssignment(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="board_assignment",
    )
    club = models.ForeignKey(
        "core_data.Club",
        on_delete=models.CASCADE,
        related_name="board_assignments",
    )


class EmailVerification(models.Model):
    email = models.EmailField(unique=True)
    code_hash = models.CharField(max_length=128)
    registration_data = models.JSONField()
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
