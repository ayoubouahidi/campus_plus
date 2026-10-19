from rest_framework import serializers

import secrets

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Club, ClubEvent, Department, UserMember


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'title']


class ClubSerializer(serializers.ModelSerializer):
    president = serializers.PrimaryKeyRelatedField(
        source='head',
        queryset=UserMember.objects.all(),
        required=False,
        allow_null=True,
    )
    member_count = serializers.IntegerField(source='members.count', read_only=True)
    event_count = serializers.IntegerField(source='events.count', read_only=True)

    class Meta:
        model = Club
        fields = [
            'id',
            'name',
            'description',
            'department',
            'president',
            'member_count',
            'event_count',
            'contact_email',
            'meeting_day',
            'meeting_time',
            'meeting_location',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_president(self, president):
        department = self.initial_data.get('department')
        if president and department and president.department_id_id != int(department):
            raise serializers.ValidationError(
                'The president must belong to the club department.'
            )
        return president


class ClubEventSerializer(serializers.ModelSerializer):
    parent = serializers.CharField(source='parent_id.title', read_only=True)

    class Meta:
        model = ClubEvent
        fields = [
            'id',
            'name',
            'description',
            'parent_id',
            'club',
            'parent',
            'starts_at',
            'ends_at',
            'location',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


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