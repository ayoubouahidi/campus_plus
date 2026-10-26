#!/bin/sh
mkdir -p infrastructure/nginx/certs
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout infrastructure/nginx/certs/key.pem \
  -out infrastructure/nginx/certs/cert.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"