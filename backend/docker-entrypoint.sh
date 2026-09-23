#!/bin/sh
set -e

# Aplica migraciones pendientes antes de levantar el server. Idempotente:
# no hace nada si ya están todas aplicadas.
uv run alembic upgrade head

exec uv run uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
