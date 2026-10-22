
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

env_file = Path(".env")
redis_line = "REDIS_URL=redis://127.0.0.1:6379/0"

if not env_file.exists():
    env_file.write_text(
        f"DJANGO_SECRET_KEY={get_random_secret_key()}\n"
        f"{redis_line}\n"
    )
    env_file.chmod(0o600)
    print("Created .env with a new Django secret key.")
else:
    content = env_file.read_text()
    additions = []

    if not any(line.startswith("DJANGO_SECRET_KEY=") for line in content.splitlines()):
        additions.append(f"DJANGO_SECRET_KEY={get_random_secret_key()}")

    if not any(line.startswith("REDIS_URL=") for line in content.splitlines()):
        additions.append(redis_line)

    if additions:
        with env_file.open("a") as file:
            file.write("\n" + "\n".join(additions) + "\n")

    env_file.chmod(0o600)
    print("Existing .env preserved.")
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
