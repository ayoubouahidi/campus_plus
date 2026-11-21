from rest_framework import serializers


class AuthSyncSerializer(serializers.Serializer):
    fortyTwoId = serializers.IntegerField(min_value=1)
    login = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    firstName = serializers.CharField(max_length=150, required=False, allow_blank=True)
    lastName = serializers.CharField(max_length=150, required=False, allow_blank=True)
    imageUrl = serializers.URLField(required=False, allow_blank=True)
    campus = serializers.CharField(max_length=100, required=False, allow_blank=True)


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)
    full_name = serializers.SerializerMethodField()
    login = serializers.CharField(source="username", read_only=True)
    avatar_url = serializers.CharField(read_only=True)
    campus = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    club_id = serializers.SerializerMethodField()
    club_slug = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_club_id(self, obj):
        try:
            return obj.usermember.club_id_id
        except AttributeError:
            return None

    def get_club_slug(self, obj):
        try:
            club = obj.usermember.club_id
            return getattr(club, "slug", None) if club else None
        except AttributeError:
            return None


class UserPhoneSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30, allow_blank=True, required=True)


class EmailPasswordLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        trim_whitespace=False,
        write_only=True,
    )
