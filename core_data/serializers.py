import secrets

from django.contrib.auth import get_user_model
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Club, ClubEvent, Department, UserMember


User = get_user_model()


def absolute_file_url(file_field, context, empty_value):
    """Return an absolute media URL when a request is available."""
    if not file_field:
        return empty_value

    url = file_field.url
    request = context.get('request')
    if request is None:
        return url
    return request.build_absolute_uri(url)


class DepartmentSerializer(serializers.ModelSerializer):
    # [ahmed] Keep the legacy title while publishing the frontend's field name.
    name = serializers.CharField(source='title', read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'title', 'slug']
        read_only_fields = ['slug']


class ClubSerializer(serializers.ModelSerializer):
    president = serializers.PrimaryKeyRelatedField(
        source='head',
        queryset=UserMember.objects.all(),
        required=False,
        allow_null=True,
    )
    department_id = serializers.IntegerField(read_only=True)
    department_name = serializers.CharField(
        source='department.title',
        read_only=True,
    )
    department_slug = serializers.CharField(
        source='department.slug',
        read_only=True,
        allow_null=True,
    )
    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    president_name = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    event_count = serializers.SerializerMethodField()
    upcoming_event_count = serializers.SerializerMethodField()
    # [ahmed] Preserve existing write input without leaking it publicly.
    contact_email = serializers.EmailField(write_only=True, required=False)

    @extend_schema_field(OpenApiTypes.STR)
    def get_logo_url(self, club):
        return absolute_file_url(club.logo, self.context, '')

    @extend_schema_field({'type': 'string', 'nullable': True})
    def get_banner_url(self, club):
        return absolute_file_url(club.banner, self.context, None)

    @extend_schema_field(OpenApiTypes.STR)
    def get_president_name(self, club):
        if club.head is None:
            return ''
        return f'{club.head.first_name} {club.head.last_name}'.strip()

    @staticmethod
    @extend_schema_field(OpenApiTypes.INT)
    def get_member_count(club):
        if hasattr(club, 'member_count'):
            return club.member_count
        return club.members.count()

    @staticmethod
    @extend_schema_field(OpenApiTypes.INT)
    def get_event_count(club):
        if hasattr(club, 'event_count'):
            return club.event_count
        return club.events.count()

    @staticmethod
    @extend_schema_field(OpenApiTypes.INT)
    def get_upcoming_event_count(club):
        if hasattr(club, 'upcoming_event_count'):
            return club.upcoming_event_count
        return club.events.filter(ends_at__gt=timezone.now()).count()

    class Meta:
        model = Club
        fields = [
            'id',
            'slug',
            'name',
            'description',
            'department',
            'department_id',
            'department_name',
            'department_slug',
            'logo_url',
            'banner_url',
            'president',
            'president_name',
            'member_count',
            'event_count',
            'upcoming_event_count',
            'contact_email',
            'meeting_day',
            'meeting_time',
            'meeting_location',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']

    def validate_president(self, president):
        department = self.initial_data.get('department')
        if president and department and president.department_id_id != int(department):
            raise serializers.ValidationError(
                'The president must belong to the club department.'
            )
        return president


class ClubEventSerializer(serializers.ModelSerializer):
    parent = serializers.CharField(source='parent_id.title', read_only=True)
    # [ahmed] Publish the frontend's event names without renaming database fields.
    title = serializers.CharField(source='name', read_only=True)
    category = serializers.ChoiceField(
        choices=ClubEvent.CATEGORY_CHOICES,
        required=False,
        allow_null=True,
    )
    capacity = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
    )
    club_id = serializers.IntegerField(read_only=True, allow_null=True)
    club_name = serializers.CharField(
        source='club.name',
        read_only=True,
        allow_null=True,
    )
    club_slug = serializers.CharField(
        source='club.slug',
        read_only=True,
        allow_null=True,
    )
    department_name = serializers.CharField(
        source='parent_id.title',
        read_only=True,
    )
    department_slug = serializers.CharField(
        source='parent_id.slug',
        read_only=True,
    )
    flyer_url = serializers.SerializerMethodField()
    start_time = serializers.DateTimeField(source='starts_at', read_only=True)
    end_time = serializers.DateTimeField(source='ends_at', read_only=True)
    rsvps_count = serializers.SerializerMethodField()
    has_user_rsvpd = serializers.SerializerMethodField()
    attendees_preview = serializers.SerializerMethodField()

    @extend_schema_field(OpenApiTypes.STR)
    def get_flyer_url(self, event):
        return absolute_file_url(event.image_path, self.context, '')

    @extend_schema_field(OpenApiTypes.INT)
    def get_rsvps_count(self, event):
        annotated_count = getattr(event, 'rsvps_count', None)
        if annotated_count is not None:
            return annotated_count
        return 0

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_has_user_rsvpd(self, event):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        annotated_status = getattr(event, 'has_user_rsvpd', None)
        if annotated_status is not None:
            return annotated_status
        return False

    @extend_schema_field(
        {
            'type': 'array',
            'maxItems': 3,
            'items': {'$ref': '#/components/schemas/Attendee'},
        }
    )
    def get_attendees_preview(self, event):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated or event.pk is None:
            return []
        rsvps = getattr(event, 'attendees_preview_rsvps', None)
        if rsvps is None:
            return []
        return AttendeeSerializer(
            [rsvp.user for rsvp in rsvps],
            many=True,
            context=self.context,
        ).data

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        is_superadmin = bool(
            user
            and user.is_authenticated
            and (
                getattr(user, 'role', None) == 'SUPERADMIN'
                or user.is_superuser
            )
        )
        if self.instance is not None and not is_superadmin:
            relationship_errors = {}
            protected_relationships = {
                'club': (
                    self.instance.club_id,
                    "Only a superadmin may change or remove an event's club.",
                ),
                'parent_id': (
                    self.instance.parent_id_id,
                    "Only a superadmin may change an event's department.",
                ),
            }
            for field_name, (current_id, message) in protected_relationships.items():
                if field_name not in attrs:
                    continue
                submitted_value = attrs[field_name]
                submitted_id = getattr(submitted_value, 'pk', None)
                if submitted_id != current_id:
                    relationship_errors[field_name] = message

            if relationship_errors:
                raise serializers.ValidationError(relationship_errors)

        effective_club = attrs.get('club')
        if 'club' not in attrs and self.instance is not None:
            effective_club = self.instance.club

        effective_department = attrs.get('parent_id')
        if effective_department is not None:
            effective_department_id = effective_department.pk
        elif self.instance is not None:
            effective_department_id = self.instance.parent_id_id
        else:
            effective_department_id = None

        if (
            effective_club is not None
            and effective_department_id is not None
            and effective_club.department_id != effective_department_id
        ):
            raise serializers.ValidationError({
                'parent_id': (
                    "The event department must match the selected club's "
                    'department.'
                ),
            })

        event_errors = {}
        if self.instance is None:
            for field_name in ('category', 'starts_at', 'ends_at'):
                if attrs.get(field_name) is None:
                    event_errors[field_name] = 'This field is required.'
        elif 'category' in attrs and attrs['category'] is None:
            event_errors['category'] = 'This field may not be null.'

        validate_schedule = (
            self.instance is None
            or 'starts_at' in attrs
            or 'ends_at' in attrs
        )
        if validate_schedule:
            effective_start = attrs.get('starts_at')
            effective_end = attrs.get('ends_at')
            if self.instance is not None:
                if 'starts_at' not in attrs:
                    effective_start = self.instance.starts_at
                if 'ends_at' not in attrs:
                    effective_end = self.instance.ends_at

            if effective_start is None:
                event_errors['starts_at'] = 'This field is required.'
            if effective_end is None:
                event_errors['ends_at'] = 'This field is required.'
            if (
                effective_start is not None
                and effective_end is not None
                and effective_end <= effective_start
            ):
                event_errors['ends_at'] = (
                    'The end datetime must be later than the start datetime.'
                )

        if event_errors:
            raise serializers.ValidationError(event_errors)

        return attrs

    class Meta:
        model = ClubEvent
        fields = [
            'id',
            'title',
            'name',
            'description',
            'parent_id',
            'club',
            'club_id',
            'club_name',
            'club_slug',
            'parent',
            'department_name',
            'department_slug',
            'flyer_url',
            'starts_at',
            'ends_at',
            'start_time',
            'end_time',
            'location',
            'category',
            'status',
            'capacity',
            'rsvps_count',
            'has_user_rsvpd',
            'attendees_preview',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'created_at',
            'updated_at',
        ]


class AttendeeSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.CharField(read_only=True)

    @extend_schema_field(OpenApiTypes.STR)
    def get_full_name(self, user):
        return user.get_full_name() or user.username


class RsvpStatusSerializer(serializers.Serializer):
    rsvps_count = serializers.IntegerField(read_only=True)
    has_user_rsvpd = serializers.BooleanField(read_only=True)


class PaginatedAttendeeSerializer(serializers.Serializer):
    count = serializers.IntegerField(read_only=True)
    next = serializers.URLField(read_only=True, allow_null=True)
    previous = serializers.URLField(read_only=True, allow_null=True)
    results = AttendeeSerializer(many=True, read_only=True)


class UserMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = UserMember
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'year_of_study',
            'email',
            'department_id',
            'club_id',
            'event_date',
            'role',
            'image_path',
        ]


class SignupSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    year_of_study = serializers.IntegerField(min_value=1, max_value=7)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
    )
    club_id = serializers.PrimaryKeyRelatedField(
        queryset=Club.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_email(self, email):
        normalized_email = email.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError(
                'An account with this email already exists.'
            )
        return normalized_email

    def validate(self, attrs):
        club = attrs.get('club_id')
        if club and club.department_id != attrs['department_id'].id:
            raise serializers.ValidationError(
                {'club_id': 'The club must belong to the selected department.'}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        department = validated_data.pop('department_id')
        club = validated_data.pop('club_id', None)
        first_name = validated_data['first_name']
        last_name = validated_data['last_name']
        email = validated_data.pop('email')
        year_of_study = validated_data.pop('year_of_study')

        while True:
            username = f'user_{secrets.token_hex(8)}'
            if not User.objects.filter(username=username).exists():
                break

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        member = UserMember.objects.create(
            user=user,
            username=username,
            first_name=user.first_name,
            last_name=user.last_name,
            year_of_study=year_of_study,
            department_id=department,
            club_id=club,
        )
        return member
