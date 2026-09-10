# Backend

API en FastAPI + infraestructura de base de datos (PostgreSQL + pgAdmin vía Docker Compose).
El venv y las dependencias los gestiona [uv](https://docs.astral.sh/uv/) (`pyproject.toml` +
`uv.lock`). Instalar uv si no lo tenés:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Arquitectura

```
app/
  core/               Config, logging y security transversales (no dependen de módulos de negocio)
    config.py         Settings (pydantic-settings), lee variables de entorno / .env
    logging.py        Setup de logging de la app
    security.py       Hashing de contraseñas y JWT
  db/
    session.py        Engine + SessionLocal + dependencia get_db
    base.py            Base declarativa de SQLAlchemy
    base_metadata.py   Importa todos los modelos (para Alembic autogenerate)
    seed.py             Usuarios de prueba (python -m app.db.seed)
  api/
    v1/
      router.py         Agrega los routers de cada módulo bajo /api/v1
  modules/              Un paquete por dominio de negocio
    auth/                 Login, registro, usuario actual
      models.py
      schemas.py
      service.py          Lógica de negocio (sin FastAPI)
      dependencies.py     Dependencias de FastAPI (get_current_user, etc.)
      router.py           Endpoints HTTP
  main.py               Arma la app FastAPI (create_app), CORS, health check
alembic/                Migraciones de base de datos
```

Cada módulo de negocio nuevo (products, cart, orders, ...) sigue la misma
estructura que `modules/auth`: `models.py` + `schemas.py` + `service.py` +
`router.py`, incluido en `app/api/v1/router.py`.

## Cómo levantarlo

```bash
cp .env.example .env              # ajustar credenciales/SECRET_KEY si hace falta
docker compose up -d              # levanta Postgres + pgAdmin

uv sync                            # crea .venv e instala las deps (según uv.lock)

uv run alembic upgrade head        # crea las tablas
uv run python -m app.db.seed       # crea los usuarios de prueba (ver más abajo)
uv run uvicorn app.main:app --reload  # http://localhost:8000
```

`uv run <comando>` corre `<comando>` dentro del `.venv` del proyecto sin necesidad de
activarlo a mano. Si preferís activarlo (`source .venv/bin/activate`), después podés usar
los comandos sueltos (`alembic ...`, `uvicorn ...`) igual que antes.

- **API** → http://localhost:8000 (docs interactivas en `/docs`)
- **PostgreSQL** → `localhost:5432`
- **pgAdmin** → http://localhost:5050

El frontend (`../frontend`) ya apunta a `http://localhost:8000/api/v1` para el login
(`src/app/core/services/auth.service.ts` + `core/config/api.config.ts`); con CORS habilitado
para `http://localhost:4200` (ver `CORS_ORIGINS` en `.env`).

## Endpoints de auth (`/api/v1/auth`)

| Método | Ruta        | Descripción                                  |
|--------|-------------|-----------------------------------------------|
| POST   | `/register` | Crea un usuario `customer` (`email`, `password`, `full_name?`) |
| POST   | `/login`    | Form-encoded (`username`=email, `password`), devuelve JWT |
| GET    | `/me`       | Usuario actual, incluye `role` (requiere `Authorization: Bearer <token>`) |

`role` es `"customer"` o `"admin"`. El registro público siempre crea `"customer"` — no hay
forma de pedir `admin` por la API; un admin se crea por seed o a mano en la base.

## Usuarios de prueba (seed)

```bash
uv run python -m app.db.seed
```

Es idempotente (correrlo de nuevo no pisa nada si el usuario ya existe). Crea:

| Rol      | Email              | Contraseña    |
|----------|---------------------|---------------|
| Admin    | `admin@demo.com`    | `admin1234`   |
| Cliente  | `cliente@demo.com`  | `cliente1234` |

Para agregar más usuarios de prueba, sumar entradas a `SEED_USERS` en `app/db/seed.py`.

## Migraciones

```bash
uv run alembic revision --autogenerate -m "descripción del cambio"
uv run alembic upgrade head
```

La URL de conexión para Alembic sale de `app.core.config.settings` (o sea,
del mismo `.env`), no hay que tocar `alembic.ini`.

## Agregar/quitar dependencias

```bash
uv add nombre-paquete       # lo suma a pyproject.toml, actualiza uv.lock e instala
uv remove nombre-paquete
```

No editar `pyproject.toml`/`uv.lock` a mano ni usar `pip install` suelto: se desincroniza
del lockfile y deja de ser reproducible.

## Apagar

```bash
docker compose down        # mantiene los datos (volúmenes)
docker compose down -v     # borra también los datos
```
