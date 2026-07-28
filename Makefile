.PHONY: dev api web db-up db-migrate test test-api test-core test-web lint e2e seed

db-up:
	docker compose up -d postgres

db-migrate:
	cd apps/api && uv run alembic upgrade head

api:
	cd apps/api && uv run uvicorn my_assist_api.main:app --reload --port 8000 --workers 1

web:
	cd apps/web && npm run dev

dev:
	$(MAKE) -j2 api web

test-core:
	cd packages/agent_core && uv run pytest -q

test-api:
	cd apps/api && uv run pytest -q

test-web:
	cd apps/web && npm test -- --run

test: test-core test-api test-web

lint:
	cd packages/agent_core && uv run ruff check . && uv run ruff format --check .
	cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy my_assist_api
	cd packages/agent_core && uv run mypy agent_core
	cd apps/web && npm run lint && npx tsc --noEmit

e2e:
	cd apps/web && npx playwright test

seed:
	cd apps/api && uv run python -m my_assist_api.seed
