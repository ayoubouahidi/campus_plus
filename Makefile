up:
	docker compose up -d --build

down:
	docker compose down

# Frontend with live reload: mounts ./frontend into the container (docker-compose.dev.yml).
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

lint:
	docker compose exec frontend npx eslint .

typecheck:
	docker compose exec frontend npx tsc --noEmit

logs:
	docker compose logs -f

clean:
	docker compose down -v --remove-orphans

fclean: clean
	docker compose down --rmi all -v --remove-orphans
	docker builder prune -f

re: fclean up

.PHONY: up dev down logs lint typecheck clean fclean re
