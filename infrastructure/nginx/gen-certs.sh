#!/bin/sh
mkdir -p ./certs
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout ./certs/key.pem \
  -out ./certs/cert.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"