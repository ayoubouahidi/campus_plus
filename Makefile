# Production: the frontend's last Dockerfile stage (next build + standalone server).
up:
	docker compose up -d --build

down:
	docker compose down

# Frontend with live reload: mounts ./frontend into the container (docker-compose.dev.yml).
# --renew-anon-volumes: node_modules lives in an anonymous volume; without it a rebuilt image (new dependency)
# would keep the old volume and fail with "Module not found" (frontend DOCS.md §12.1).
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --renew-anon-volumes

# Checks run in a throwaway container of the `dev` stage, with the source mounted: they work whether the
# production image (`make up`, no dev tools inside) or the dev server (`make dev`) is running (DOCS.md §19).
DEV_RUN = docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps -T frontend

lint:
	$(DEV_RUN) npx eslint .

typecheck:
	$(DEV_RUN) npx tsc --noEmit

# Production build check without starting anything: builds the image up to its last stage (type check included).
build-check:
	docker compose build frontend

# Drop Next's resized-image cache (needed after replacing a public/ image but keeping its file name).
clear-images:
	docker compose exec frontend rm -rf /app/.next/dev/cache/images /app/.next/cache/images

logs:
	docker compose logs -f

clean:
	docker compose down -v --remove-orphans

fclean: clean
	docker compose down --rmi all -v --remove-orphans
	docker builder prune -f

re: fclean up

.PHONY: up dev down logs lint typecheck build-check clear-images clean fclean re
