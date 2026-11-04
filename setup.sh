
#!/usr/bin/env bash
set -euo pipefail

echo "===================================="
echo "  Campus Plus — Development Setup"
echo "===================================="

# [Member 3] Always run from the project's root directory.
cd "$(dirname "$0")"

# [Member 3] Keep the uv cache on goinfre to avoid home storage limits.
export UV_CACHE_DIR="/goinfre/$USER/.uv-cache"
mkdir -p "$UV_CACHE_DIR"

# [Member 3] Check that uv is available.
if ! command -v uv >/dev/null 2>&1; then
    echo "ERROR: uv is not installed."
    exit 1
fi

# [Member 3] Create a virtual environment when one doesn't exist.
if [ ! -x ".venv/bin/python" ]; then
    echo "[1/5] Creating virtual environment..."
    uv venv .venv --python 3.14
else
    echo "[1/5] Virtual environment already exists."
fi

# [Member 3] Install all declared project dependencies.
echo "[2/5] Installing dependencies..."
uv pip install --python .venv/bin/python -r requirements.txt

# [Member 3] Ensure Daphne is installed while older branches
# are missing it from requirements.txt.
uv pip install --python .venv/bin/python "daphne>=4.2,<5.0"

# [Member 3] Create secure local configuration without exposing secrets.
echo "[3/5] Configuring environment..."

.venv/bin/python - <<'PY'
from pathlib import Path
from django.core.management.utils import get_random_secret_key

# [ahmed] Generate cryptographically secure PostgreSQL credentials.
import secrets

env_file = Path(".env")
redis_line = "REDIS_URL=redis://127.0.0.1:6379/0"

# [ahmed] Define all required Campus Plus environment variables.
# [ahmed] Generate secrets only when they do not already exist.
required_variables = {
    "DJANGO_SECRET_KEY": lambda: get_random_secret_key(),
    "REDIS_URL": lambda: redis_line.split("=", 1)[1],
    "POSTGRES_DB": lambda: "campus_plus",
    "POSTGRES_USER": lambda: "campus_user",
    "POSTGRES_PASSWORD": lambda: secrets.token_urlsafe(32),
    "DEBUG": lambda: "true",
    "DJANGO_ALLOWED_HOSTS": lambda: "localhost,127.0.0.1,web",
    "WS_AUTH_BACKEND": lambda: "token_dev",
}

# [ahmed] Preserve existing environment variables and credentials.
if env_file.exists():
    content = env_file.read_text()
    existing_keys = {
        line.split("=", 1)[0].strip()
        for line in content.splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    }
else:
    content = ""
    existing_keys = set()

# [ahmed] Find missing variables without replacing existing values.
additions = []

for key, generator in required_variables.items():
    if key not in existing_keys:
        value = generator()
        additions.append(f"{key}={value}")

# [ahmed] Create or update .env only when necessary.
if additions:
    with env_file.open("a") as file:
        if content and not content.endswith("\n"):
            file.write("\n")

        file.write("\n".join(additions) + "\n")

    print("Environment configuration updated.")
    print("Added variables:")

    # [ahmed] Display variable names only, never secret values.
    for line in additions:
        print(f"  + {line.split('=', 1)[0]}")
else:
    print("All required environment variables already exist.")

# [ahmed] Restrict access to the local environment file.
env_file.chmod(0o600)

print("Environment setup completed.")
PY

# [Member 3] Prevent accidentally committing secrets and local files.
if ! git check-ignore -q .env; then
    echo "WARNING: .env is not ignored by Git!"
    exit 1
fi

# [Member 3] Validate Django configuration.
echo "[4/5] Checking Django..."
.venv/bin/python manage.py check

# [Member 3] Run the project's automated tests.
echo "[5/5] Running tests..."
.venv/bin/python manage.py test

echo "===================================="
echo "  Campus Plus setup completed!"
echo "===================================="
echo "Activate with: source .venv/bin/activate"
echo "Start Django with: python manage.py runserver"

# [ahmed] Display the Docker infrastructure command.
echo "Start Docker with: docker compose up -d --build"
echo "Check containers with: docker compose ps"
