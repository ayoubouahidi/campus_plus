"""Bounded negative-security probe for the live Nginx/Daphne WSS path.

The probe creates credentials only in process memory and never prints them. It
does not create users or write to the database. A trusted local CA file is
required; TLS verification is never disabled.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
import json
import os
from pathlib import Path
import ssl
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

import django

django.setup()

from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus


OPEN_TIMEOUT = 3
CLOSE_TIMEOUT = 2


def signed_nonexistent_access_token() -> str:
    token = AccessToken()
    token["user_id"] = 2_147_483_647
    return str(token)


def signed_expired_token() -> str:
    token = AccessToken()
    token["user_id"] = 2_147_483_647
    token.set_exp(lifetime=timedelta(seconds=-30))
    return str(token)


def signed_refresh_token() -> str:
    token = RefreshToken()
    token["user_id"] = 2_147_483_647
    return str(token)


async def rejection_result(
    *,
    name: str,
    uri: str,
    ssl_context: ssl.SSLContext,
    origin: str | None,
    cookie: str | None,
) -> tuple[str, str]:
    headers = []
    if cookie is not None:
        headers.append(("Cookie", cookie))

    try:
        async with connect(
            uri,
            origin=origin,
            additional_headers=headers,
            ssl=ssl_context,
            proxy=None,
            open_timeout=OPEN_TIMEOUT,
            close_timeout=CLOSE_TIMEOUT,
            ping_interval=None,
        ) as websocket:
            try:
                message = await asyncio.wait_for(
                    websocket.recv(),
                    timeout=CLOSE_TIMEOUT,
                )
            except ConnectionClosed as error:
                if error.code == 4401:
                    return name, "rejected after upgrade with close code 4401"
                return name, f"FAILED: unexpected close code {error.code}"
            except TimeoutError:
                return name, "FAILED: connection remained open"
            else:
                try:
                    parsed = json.loads(message)
                except (json.JSONDecodeError, TypeError):
                    parsed = None
                message_type = parsed.get("type") if isinstance(parsed, dict) else None
                return name, f"FAILED: received message type {message_type!r}"
    except InvalidStatus as error:
        status = error.response.status_code
        if status == 403:
            return name, "rejected during HTTP upgrade with status 403"
        return name, f"FAILED: unexpected HTTP status {status}"
    except (OSError, ssl.SSLError) as error:
        return name, f"BLOCKED: transport error {type(error).__name__}"


async def run() -> int:
    uri = os.getenv("A17_WSS_URL", "wss://localhost:8443/ws/calendar/")
    origin = os.getenv("A17_TRUSTED_ORIGIN", "https://localhost:8443")
    ca_file = Path(
        os.getenv(
            "A17_CA_FILE",
            "infrastructure/nginx/certs/cert.pem",
        )
    )
    if not ca_file.is_file():
        print(f"BLOCKED: CA file does not exist: {ca_file}", file=sys.stderr)
        return 2

    ssl_context = ssl.create_default_context(cafile=ca_file)
    ssl_context.check_hostname = True
    ssl_context.verify_mode = ssl.CERT_REQUIRED

    access = signed_nonexistent_access_token()
    scenarios = [
        {
            "name": "missing credentials",
            "origin": origin,
            "cookie": None,
        },
        {
            "name": "malformed JWT",
            "origin": origin,
            "cookie": "ws_access=invalid.jwt.token",
        },
        {
            "name": "expired JWT",
            "origin": origin,
            "cookie": f"ws_access={signed_expired_token()}",
        },
        {
            "name": "refresh token",
            "origin": origin,
            "cookie": f"ws_access={signed_refresh_token()}",
        },
        {
            "name": "duplicate authentication cookie",
            "origin": origin,
            "cookie": "ws_access=invalid.jwt.token; ws_access=other.jwt.token",
        },
        {
            "name": "missing Origin",
            "origin": None,
            "cookie": f"ws_access={access}",
        },
        {
            "name": "untrusted Origin",
            "origin": "https://untrusted.example",
            "cookie": f"ws_access={access}",
        },
    ]

    failed = False
    blocked = False
    for scenario in scenarios:
        name, result = await rejection_result(
            uri=uri,
            ssl_context=ssl_context,
            **scenario,
        )
        print(f"{name}: {result}")
        failed = failed or result.startswith("FAILED:")
        blocked = blocked or result.startswith("BLOCKED:")

    if failed:
        return 1
    if blocked:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
