FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY infrastructure/app .

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]