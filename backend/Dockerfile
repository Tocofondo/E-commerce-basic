FROM python:3.12-slim

# Trae el binario de uv (no se instala por pip, es un binario standalone).
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Copiar solo el lockfile primero: si el código cambia pero no las
# dependencias, esta capa queda cacheada.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project

COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]
