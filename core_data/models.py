import os
import uuid
import warnings

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify
from django.utils.deconstruct import deconstructible
from PIL import Image, UnidentifiedImageError


MAX_IMAGE_SIZE = 2 * 1024 * 1024
MAX_IMAGE_DIMENSION = 4000
ALLOWED_IMAGE_FORMATS = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}
ALLOWED_IMAGE_EXTENSIONS = {
    'JPEG': {'.jpg', '.jpeg'},
    'PNG': {'.png'},
    'WEBP': {'.webp'},
}


@deconstructible
class uuid_path:
    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        extension = os.path.splitext(filename)[1].lower()
        return f"{self.folder}/{uuid.uuid4().hex}{extension}"


def validate_file_size(value):
    if value.size >= MAX_IMAGE_SIZE:
        raise ValidationError('File size must be strictly under 2MB.')


def validate_image_content(value):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(value) as image:
                image_format = image.format
                width, height = image.size
                image.verify()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError(
            f'Image dimensions must not exceed {MAX_IMAGE_DIMENSION} pixels.'
        )
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise ValidationError('The uploaded file is not a valid image.')
    finally:
        try:
            value.seek(0)
        except (AttributeError, OSError):
            raise ValidationError('The uploaded image could not be read safely.')

    expected_content_type = ALLOWED_IMAGE_FORMATS.get(image_format)
    if expected_content_type is None:
        raise ValidationError('Only JPEG, PNG, and WebP images are supported.')

    if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise ValidationError(
            f'Image dimensions must not exceed {MAX_IMAGE_DIMENSION} pixels.'
        )

    content_type = getattr(value, 'content_type', None)
    if content_type and content_type != expected_content_type:
        raise ValidationError(
            'The uploaded MIME type does not match the image content.'
        )

    extension = os.path.splitext(getattr(value, 'name', '') or '')[1].lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS[image_format]:
        raise ValidationError(
            'The filename extension does not match the image content.'
        )


class Department(models.Model):
    title = models.CharField(max_length=255)
    # [ahmed] Unique URL-friendly department identifier.
    slug = models.SlugField(
        unique=True,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ['title']
        indexes = [models.Index(fields=['title'])]

    def __str__(self):
        return self.title


class Club(models.Model):
    name = models.CharField(max_length=255)
    # [ahmed] Unique URL identifier for each club.
    slug = models.SlugField(
        max_length=100,
        unique=True,
    )
    description = models.TextField(blank=True)
    logo = models.ImageField(
        upload_to=uuid_path('club_logos'),
        validators=[validate_file_size, validate_image_content],
        blank=True,
    )

    banner = models.ImageField(
        upload_to=uuid_path('club_banners'),
        validators=[validate_file_size, validate_image_content],
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='clubs',
    )
    head = models.ForeignKey(
        'UserMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_clubs',
    )
    contact_email = models.EmailField(blank=True)
    meeting_day = models.CharField(max_length=20, blank=True)
    meeting_time = models.TimeField(null=True, blank=True)
    meeting_location = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['department', 'name'],
                name='unique_club_name_per_department',
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)[:100] or 'club'
            candidate = base_slug
            suffix = 2
            existing = type(self).objects.exclude(pk=self.pk)
            while existing.filter(slug=candidate).exists():
                suffix_text = f'-{suffix}'
                candidate = f'{base_slug[:100 - len(suffix_text)]}{suffix_text}'
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)


class ClubEvent(models.Model):
    STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    # [ahmed] Categories used to classify events.
    CATEGORY_CHOICES = [
        ('Tech', 'Tech'),
        ('Media', 'Media'),
        ('Music', 'Music'),
        ('Sports', 'Sports'),
        ('Business', 'Business'),
        ('EventsOrganization', 'Events Organization'),
        ('Gaming', 'Gaming'),
    ]
    image_path = models.ImageField(
        upload_to=uuid_path('events_pics'),
        validators=[validate_file_size, validate_image_content],
        blank=True,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    # [ahmed] Category used to filter events.
    category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES,
        null=True,
        blank=True,
    )

    # [ahmed] Maximum participants; None means unlimited.
    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    parent_id = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='clubs_events',
        db_index=False,
    )
    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name='events',
        null=True,
        blank=True,
    )
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        # [ahmed] Display events chronologically.
        ordering = ['starts_at']

        indexes = [
            models.Index(fields=['parent_id', 'name']),
            models.Index(fields=['club', 'starts_at']),
        ]

        # [ahmed] Prevent an event from ending before or at its start.
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F('starts_at')),
                name='clubevent_end_after_start',
            ),
        ]

    def __str__(self):
        return self.name


class UserMember(models.Model):
    username = models.CharField(max_length=150, unique=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    # [ahmed] Optional contact number for the student.
    phone = models.CharField(max_length=30, blank=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    year_of_study = models.PositiveSmallIntegerField(null=True, blank=True)
    department_id = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='members',
    )
    club_id = models.ForeignKey(
        Club,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='members',
    )
    event_date = models.DateTimeField(null=True, blank=True)
    role = models.CharField(max_length=50, null=True, blank=True)
    image_path = models.ImageField(
        upload_to='avatars/',
        validators=[validate_file_size, validate_image_content],
        blank=True,
    )

    class Meta:
        indexes = [
            models.Index(fields=['department_id']),
            models.Index(fields=['club_id']),
            models.Index(fields=['event_date']),
        ]

    def __str__(self):
        return self.username

# [ahmed] Records which authenticated users registered for which events.
class Rsvp(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='rsvps',
    )

    event = models.ForeignKey(
        ClubEvent,
        on_delete=models.CASCADE,
        related_name='rsvps',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'event'],
                name='one_rsvp_per_user_event',
            )
        ]

        indexes = [
            models.Index(fields=['event', '-created_at'])
        ]
