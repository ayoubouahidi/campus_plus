from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView


class PublicLivenessView(APIView):
    """Base class that preserves GET/HEAD-only public probe behavior."""

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ['get', 'head']

    def http_method_not_allowed(self, request, *args, **kwargs):
        return HttpResponseNotAllowed(['GET', 'HEAD'])


class HealthView(PublicLivenessView):
    @extend_schema(
        summary='Check API liveness',
        description=(
            'Public compatibility liveness response for Hamza infrastructure. '
            'It performs no database, Redis, or Channels checks and must not be '
            'interpreted as dependency readiness.'
        ),
        responses={
            200: inline_serializer(
                name='HealthResponse',
                fields={
                    'status': serializers.CharField(default='ok'),
                    'message': serializers.CharField(default='API is running'),
                },
            ),
        },
        auth=[],
    )
    def get(self, request):
        return JsonResponse({
            'status': 'ok',
            'message': 'API is running',
        })


class HealthLiveView(PublicLivenessView):
    @extend_schema(
        summary='Check process liveness',
        description=(
            'Public lightweight probe for Docker, Nginx, and load balancers. '
            'Returns plain text and performs no external dependency checks.'
        ),
        responses={(200, 'text/plain'): OpenApiTypes.STR},
        auth=[],
    )
    def get(self, request):
        return HttpResponse('ok', content_type='text/plain')
