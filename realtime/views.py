from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken


class RealtimeTokenView(APIView):
    """Issue a short-lived WebSocket JWT for the authenticated HTTP user."""

    permission_classes = [IsAuthenticated]
    http_method_names = ['post']

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

    @extend_schema(
        summary='Issue a WebSocket access token',
        description=(
            'Requires DRF token authentication. Issues a short-lived SimpleJWT '
            'access token for the authenticated request user when WebSocket JWT '
            'authentication is enabled. The Next.js server must set the returned '
            'token as a secure `ws_access` cookie; Django does not set the cookie.'
        ),
        request=None,
        responses={
            200: inline_serializer(
                name='RealtimeTokenResponse',
                fields={
                    'access': serializers.CharField(),
                    'expires_in': serializers.IntegerField(min_value=1),
                },
            ),
            401: OpenApiResponse(
                description='Authentication credentials were not provided or are invalid.'
            ),
            403: OpenApiResponse(
                description='The authenticated user is inactive.'
            ),
            503: OpenApiResponse(
                description='WebSocket JWT authentication is disabled.'
            ),
        },
    )
    def post(self, request):
        if getattr(settings, 'WS_AUTH_BACKEND', 'token_dev') != 'jwt':
            return Response(
                {'detail': 'WebSocket JWT authentication is disabled.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not getattr(request.user, 'is_active', False):
            return Response(
                {'detail': 'Inactive users cannot request WebSocket tokens.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        token = AccessToken.for_user(request.user)
        expires_in = token['exp'] - token['iat']
        return Response({
            'access': str(token),
            'expires_in': expires_in,
        })
