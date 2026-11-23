.PHONY: all certs up down logs clean re

all: up

certs:
	@if [ ! -f infrastructure/nginx/certs/cert.pem ] || [ ! -f infrastructure/nginx/certs/key.pem ]; then \
		echo "Generating self-signed SSL certificates..."; \
		sh infrastructure/nginx/gen-certs.sh; \
	fi

up: certs
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	docker compose down -v --remove-orphans

re: clean up