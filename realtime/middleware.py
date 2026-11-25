
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


# [ahmed] Find the user belonging to a Django REST Framework token.
@database_sync_to_async
def get_token_user(token_key):
    try:
        token = Token.objects.select_related("user").get(
            key=token_key
        )
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


# [ahmed] Authenticate WebSocket clients using their API tokens.
class TokenAuthMiddleware(BaseMiddleware):

    async def __call__(self, scope, receive, send):
        # [ahmed] Read the query parameters from the WebSocket URL.
        query_string = scope.get("query_string", b"").decode(
            "utf-8",
            errors="replace",
        )

        parameters = parse_qs(query_string)

        # [ahmed] Read the token, if exactly one was provided.
        tokens = parameters.get("token", [])

        scope["user"] = AnonymousUser()

        if len(tokens) == 1 and tokens[0]:
            # [ahmed] Load the user from the database.
            scope["user"] = await get_token_user(tokens[0])

        return await super().__call__(scope, receive, send)
