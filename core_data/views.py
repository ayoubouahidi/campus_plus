from django.db.models import Q
from rest_framework import filters, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from .models import Club, ClubEvent, Department, UserMember
from .serializers import (
    ClubEventSerializer,
    ClubSerializer,
    DepartmentSerializer,
    SignupSerializer,
    UserMemberSerializer,
)


class ClubEventFilterBackend(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        department = request.query_params.get('department')
        category = request.query_params.get('category')

        if department:
            queryset = queryset.filter(parent_id_id=department)
        if category:
            queryset = queryset.filter(Q(name__icontains=category) | Q(description__icontains=category))
        return queryset


class CanCreateClubEvent(BasePermission):
    message = 'Only an admin or the club head can create an event.'

    def has_permission(self, request, view):
        if request.user and request.user.is_staff:
            return True

        club_id = request.data.get('club')
        if not request.user or not request.user.is_authenticated or not club_id:
            return False

        return Club.objects.filter(
            pk=club_id,
            head__user=request.user,
        ).exists()


class ClubEventViewSet(viewsets.ModelViewSet):
    queryset = ClubEvent.objects.select_related('parent_id').all()
    serializer_class = ClubEventSerializer
    filter_backends = [ClubEventFilterBackend, SearchFilter]
    search_fields = ['name', 'description', 'parent_id__title']

    def get_permissions(self):
        if self.action == 'create':
            return [CanCreateClubEvent()]
        return [AllowAny()]


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    filter_backends = [SearchFilter]
    search_fields = ['title']


class UserMemberViewSet(viewsets.ModelViewSet):
    queryset = UserMember.objects.select_related('department_id', 'club_id').all()
    serializer_class = UserMemberSerializer

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsAdminUser()]


class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.select_related('department', 'head').prefetch_related('members')
    serializer_class = ClubSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminUser()]
        return [AllowAny()]


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    member = serializer.save()
    token, _ = Token.objects.get_or_create(user=member.user)
    return Response(
        {
            'token': token.key,
            'member': UserMemberSerializer(member).data,
        },
        status=status.HTTP_201_CREATED,
    )