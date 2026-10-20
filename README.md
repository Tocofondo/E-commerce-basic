# E-commerce Basic

Monorepo del proyecto.

## Estructura

```
frontend/   Aplicación Angular (ver frontend/README.md para correrla y su documentación)
backend/    API en FastAPI + Postgres/pgAdmin vía Docker Compose (ver backend/README.md)
deploy/     Stack de producción en un solo servidor: Caddy + backend + Postgres (ver DEPLOY.md)
```

## Levantar todo en local (macOS)

Son tres piezas: la **base de datos** (Postgres en Docker), el **backend**
(FastAPI, puerto 8000) y el **frontend** (Angular, puerto 4200). Hacen falta
dos terminales: una para el backend y otra para el frontend.

### 1. Requisitos (una sola vez)

```bash
# Homebrew, si no lo tenés: https://brew.sh
brew install --cask docker      # Docker Desktop (Postgres + pgAdmin)
brew install uv                 # gestor de Python del backend (instala Python 3.12+ solo)
brew install nvm                # para tener una versión de Node compatible
```

- Abrí **Docker Desktop** una vez y dejalo corriendo (el ícono de la ballena
  tiene que estar arriba en la barra).
- Para `nvm`, seguí lo que imprime `brew` al instalarlo (agregar unas líneas a
  `~/.zshrc`) y abrí una terminal nueva. Después:

```bash
nvm install 24                  # Angular 22 pide Node 22.22.3 / 24.15.0 / 26+
nvm use 24
```

### 2. El `.env` del backend

Solo el **backend** usa `.env` (el frontend no necesita ninguno: la URL de la
API ya está en `frontend/src/environments/environment.development.ts`).

```bash
cd backend
cp .env.example .env
```

Con los valores de `.env.example` **anda tal cual en local**, no hace falta
tocar nada. Qué es cada cosa:

| Variable | Valor local | Para qué |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `postgres` / `ecommerce` | Los usa Docker para crear la base y la API para conectarse. |
| `POSTGRES_HOST` / `POSTGRES_PORT` | `localhost` / `5432` | Dónde está Postgres (el contenedor publica el 5432). |
| `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` | `admin@admin.com` / `admin` | Login de pgAdmin en http://localhost:5050. |
| `SECRET_KEY` | el de ejemplo | Firma los JWT. En local sirve el de ejemplo; en producción es obligatorio cambiarlo. |
| `CORS_ORIGINS`, `FRONTEND_URL` | `http://localhost:4200` | Dejan que el front en el 4200 le hable a la API. |
| `SMTP_*` | vacíos | Sin SMTP no se mandan mails: el link de "olvidé mi contraseña" se imprime en la consola del backend. |
| `ORDER_NOTIFY_EMAIL` | vacío | Mail que recibe aviso de cada pedido (necesita SMTP). |

> `backend/.env` está en `.gitignore`: nunca se commitea.

### 3. Base de datos + backend (terminal 1)

```bash
cd backend
docker compose up -d                     # Postgres (5432) + pgAdmin (5050)
uv sync                                  # crea .venv e instala dependencias
uv run alembic upgrade head              # crea las tablas
uv run python -m app.core.db.seed        # carga el catálogo inicial (se puede repetir)
uv run uvicorn app.main:app --reload     # API en http://localhost:8000
```

- API: http://localhost:8000 · docs interactivas: http://localhost:8000/docs
- pgAdmin: http://localhost:5050 (para conectarte a la base desde ahí, el host
  es `postgres`, no `localhost`, porque corre dentro de Docker).

**Crear un admin** (no hay cuentas de prueba; en otra terminal, dentro de `backend/`):

```bash
uv run python -m app.core.db.create_admin
```

Pide email y contraseña por consola. Si el email ya está registrado como
cliente, lo promueve a admin. Los clientes se registran desde la web en
`/register`.

### 4. Frontend (terminal 2)

```bash
cd frontend
nvm use 24
npm install
npm start                                # http://localhost:4200
```

Abrí http://localhost:4200. El panel de admin está en `/admin` (entrando con
la cuenta creada en el paso anterior).

### Del día a día

Una vez hecho todo lo anterior, para volver a levantarlo alcanza con:

```bash
cd backend && docker compose up -d && uv run uvicorn app.main:app --reload
```

```bash
cd frontend && nvm use 24 && npm start
```

Si alguien agregó migraciones o dependencias nuevas (después de un `git pull`),
correr antes `uv sync && uv run alembic upgrade head` en `backend/` y
`npm install` en `frontend/`.

Para apagar: `Ctrl+C` en las dos terminales y `docker compose down` en
`backend/` (mantiene los datos; `docker compose down -v` los borra).

### Problemas comunes

- **`Cannot connect to the Docker daemon`**: Docker Desktop no está abierto.
- **El puerto 5432 está ocupado**: tenés otro Postgres corriendo (por ejemplo
  `brew services stop postgresql@16`), o cambiá `POSTGRES_PORT` en el `.env`.
- **`ng` se queja de la versión de Node**: te faltó `nvm use 24` en esa terminal.
- **El front carga pero no muestra productos / da error de red**: el backend
  no está corriendo en el 8000, o no corriste el seed.

## Más documentación

- Frontend: ver [`frontend/README.md`](frontend/README.md).
- Backend (API, migraciones, tests): ver [`backend/README.md`](backend/README.md).
- Producción (VPS / AWS Lightsail): ver [`DEPLOY.md`](DEPLOY.md).
