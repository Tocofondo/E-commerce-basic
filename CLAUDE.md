# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Monorepo prototype for an e-commerce store: `frontend/` (Angular) talks to a real
`backend/` (FastAPI + Postgres) **only for auth**. Everything else (catalog, cart,
orders) still lives in the browser's `localStorage` and is not shared across
devices — see "Frontend data flow" below before assuming any endpoint exists for
products/cart/orders.

## Commands

### Backend (`backend/`)

Dependencies/venv are managed by `uv` (`pyproject.toml` + `uv.lock`) — never
`pip install` loose or hand-edit `pyproject.toml`/`uv.lock`.

```bash
cp .env.example .env                    # first time only
docker compose up -d                    # Postgres + pgAdmin
uv sync                                 # create .venv, install deps from uv.lock
uv run alembic upgrade head             # apply migrations
uv run python -m app.core.db.seed       # create test users (idempotent)
uv run uvicorn app.main:app --reload    # http://localhost:8000 (docs at /docs)
```

- Add/remove a dependency: `uv add <pkg>` / `uv remove <pkg>`.
- New migration after changing models: `uv run alembic revision --autogenerate -m "..."`.
- Stop stack: `docker compose down` (add `-v` to also drop data volumes).
- No test suite or linter is configured yet for the backend (`backend/tests/`
  only has an empty `__init__.py`).

### Frontend (`frontend/`)

Requires Node v22.22.3 / v24.15.0 / v26.0.0+ (Angular CLI 22 minimum). Use `nvm`
if the installed Node is older.

```bash
npm install
npm start           # ng serve, http://localhost:4200
npm run build        # ng build
npm test             # ng test (no spec files exist yet)
```

The API base URL is hardcoded in `src/app/core/config/api.config.ts`
(`http://localhost:8000/api/v1`) — edit it if the backend runs elsewhere. No
eslint config is set up; `.prettierrc` governs formatting.

### Test accounts (from backend seed)

| Role     | Email               | Password      |
|----------|---------------------|---------------|
| Admin    | `admin@demo.com`    | `admin1234`   |
| Customer | `cliente@demo.com`  | `cliente1234` |

Add more via `SEED_USERS` in `backend/app/core/db/seed.py`.

## Architecture

### Backend — module-per-domain under `app/modules/`

```
app/
  core/       config.py (pydantic-settings, all env vars go through `settings`,
              never read os.environ directly), logging.py, security.py (password
              hashing + JWT)
    db/       session.py (engine/SessionLocal/get_db), base.py (declarative
              Base), base_metadata.py (imports all models, for Alembic
              autogenerate), seed.py (test users, run as `python -m app.core.db.seed`)
  api/v1/     router.py aggregates each module's router under /api/v1
  modules/    one package per business domain
    auth/       models.py, schemas.py, service.py (business logic, no FastAPI
                imports — testable without HTTP), dependencies.py
                (get_current_user etc.), router.py (HTTP endpoints)
  main.py     create_app(): FastAPI instance, CORS, /health
alembic/      migrations; DB URL comes from app.core.config.settings, not
              alembic.ini directly
```

Any new business module (products, cart, orders, ...) should follow the same
`models.py` + `schemas.py` + `service.py` + `router.py` shape as `modules/auth`
and get wired into `app/api/v1/router.py`.

Auth specifics: `role` (`"customer"` | `"admin"`) is never accepted from the
public `/auth/register` endpoint — only server-side code (e.g. the seed) can
create an admin. `/auth/login` is form-encoded (`OAuth2PasswordRequestForm`,
`username` = email) and returns a JWT; `/auth/me` requires `Authorization:
Bearer <token>`.

### Frontend — Angular 22, standalone components + signals

```
src/app/
  design-system/  Reusable UI components (ds-button, ds-card-product, ...).
                   Do not modify — it's the app's visual foundation. Rebrand
                   colors via src/theme/palette.css (--brand-* CSS variables).
  core/
    models/        Product, User, CartItem, Order interfaces
    services/      App state (signals) + localStorage persistence
    guards/        Route access by session/role (auth.guard.ts, admin.guard.ts)
    config/        Constants (api.config.ts, app.config.constants.ts)
  layouts/         store-layout.ts (customer navbar/footer), admin-layout.ts
  pages/           Customer pages; pages/admin/ for the admin CRUD panel
```

Routes are declared in `app.routes.ts`: customer routes are nested under
`StoreLayout`, admin routes under `AdminLayout` gated by `adminGuard`;
`checkout`, `mis-pedidos`, `perfil` are gated by `authGuard`. Guards redirect to
`/login`, or to `/` if a non-admin hits `/admin`.

### Frontend data flow (important: only auth is real)

`AuthService` is the only service that talks to the real backend: `login()`
does `POST /auth/login` then `GET /auth/me`; `core/interceptors/auth.interceptor.ts`
attaches `Authorization: Bearer <token>` to API requests and logs out on a 401.

Every other service under `core/services/` keeps its own signal-based state and
persists it to `localStorage` via the shared `Storage` helper — none of it is
synced with the backend or across devices/browsers yet:

| Service          | localStorage key | Content |
|-------------------|:---:|---|
| `ProductService`  | `ec_products` | Catalog (seeded with ~8 products) |
| `AuthService`      | `ec_session`  | JWT + current user (from backend) |
| `CartService`      | `ec_cart`     | Cart items |
| `OrderService`      | `ec_orders`   | Placed orders |

When migrating one of these to the backend, follow `AuthService` as the
reference pattern and add the matching module under `backend/app/modules/`.

### Order notifications (no backend for this yet)

Orders placed at `/checkout` show up live in `/admin/pedidos` **only within the
same browser** (shared `localStorage`, not a shared backend). To notify the
admin across devices, checkout also builds a `wa.me` link ("Enviar pedido por
WhatsApp") prefilled with the order details, since a browser can't send
WhatsApp messages on its own without the WhatsApp Business API + a backend.
Admin's WhatsApp number is `ADMIN_WHATSAPP` in
`src/app/core/config/app.config.constants.ts`.

## Out of scope (current prototype)

- Real payments (checkout only records the order).
- Admin-uploaded product images (URL-only).
- Automatic WhatsApp sending without a backend.
- Cross-device sync for catalog/cart/orders (still `localStorage`-only; login
  is the exception).
- Automated tests.
