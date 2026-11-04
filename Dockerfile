# [ahmed] Match the Python version used by the current backend.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# [ahmed] Copy the actual Campus Plus backend and realtime Django apps.
COPY . .

# [ahmed] Keep Hamza's container startup script.
COPY infrastructure/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# [ahmed] Start the existing Campus Plus ASGI application.
# [ahmed] This preserves /ws/calendar/ and its authentication middleware.
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend.asgi:application"]
