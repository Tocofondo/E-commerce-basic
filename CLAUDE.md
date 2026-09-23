# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Monorepo prototype for an e-commerce store: `frontend/` (Angular) talks to a real
`backend/` (FastAPI + Postgres) for auth, the product catalog, and orders. The
cart is the one piece still local: it lives in the browser's `localStorage` and
is not shared across devices — see "Frontend data flow" below before assuming
an endpoint exists for it.

## Commands

### Backend (`backend/`)

Dependencies/venv are managed by `uv` (`pyproject.toml` + `uv.lock`) — never
`pip install` loose or hand-edit `pyproject.toml`/`uv.lock`.

```bash
cp .env.example .env                    # first time only
docker compose up -d                    # Postgres + pgAdmin
uv sync                                 # create .venv, install deps from uv.lock
uv run alembic upgrade head             # apply migrations
uv run python -m app.core.db.seed       # create test users + catalog (idempotent)
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

### Accounts

`SEED_USERS` in `backend/app/core/db/seed.py` is empty by default — no demo
accounts are seeded, so the app behaves like a real prod deployment: customers
sign up for real at `/register` (`POST /auth/register`, always role
`"customer"`). To bootstrap an admin locally, temporarily add a tuple to
`SEED_USERS` (see the comment there) and run the seed, or create one directly
with `create_user(db, user_in, role="admin")` from a Python shell — there is
no public endpoint that can create an admin.

## Architecture

### Backend — module-per-domain under `app/modules/`

```
app/
  core/       config.py (pydantic-settings, all env vars go through `settings`,
              never read os.environ directly), logging.py, security.py (password
              hashing + JWT)
    db/       session.py (engine/SessionLocal/get_db), base.py (declarative
              Base), base_metadata.py (imports all models, for Alembic
              autogenerate), seed.py (test users + catalog, run as
              `python -m app.core.db.seed`)
  api/v1/     router.py aggregates each module's router under /api/v1
  modules/    one package per business domain
    auth/       models.py, schemas.py, service.py (business logic, no FastAPI
                imports — testable without HTTP), dependencies.py
                (get_current_user, get_current_admin_user, etc.), router.py
    products/   catalog CRUD (schemas use a Pydantic camelCase alias
                generator so the JSON matches the frontend `Product`
                interface field-for-field; `badge`/`in_stock` are computed
                properties on the ORM model, not stored as-is)
    orders/     order placement + admin status updates. `OrderItem` snapshots
                product name/image/price at purchase time (survives the
                product being edited or deleted later); `create_order`
                decrements `Product.stock` and 400s if it would go negative
  main.py     create_app(): FastAPI instance, CORS, /health
alembic/      migrations; DB URL comes from app.core.config.settings, not
              alembic.ini directly
```

Any new business module (cart, reviews, ...) should follow the same
`models.py` + `schemas.py` + `service.py` + `router.py` shape as the existing
modules and get wired into `app/api/v1/router.py`.

Auth specifics: `role` (`"customer"` | `"admin"`) is never accepted from the
public `/auth/register` endpoint — only server-side code (e.g. the seed) can
create an admin. `/auth/login` is form-encoded (`OAuth2PasswordRequestForm`,
`username` = email) and returns a JWT; `/auth/me` requires `Authorization:
Bearer <token>`. `get_current_admin_user` (in `modules/auth/dependencies.py`)
gates admin-only endpoints (product writes, `GET /orders`, order status
updates) — reuse it rather than re-checking `role` ad hoc.

### Frontend — Angular 22, standalone components + signals

```
src/app/
  design-system/  Reusable UI components (ds-button, ds-card-product, ...).
                   Do not modify — it's the app's visual foundation. Rebrand
                   colors via src/theme/palette.css (--brand-* CSS variables).
  core/
    models/        Product, User, CartItem, Order interfaces
    services/      App state as signals; `ProductService`/`OrderService`
                   back it with the API, `CartService` with localStorage
    guards/        Route access by session/role (auth.guard.ts, admin.guard.ts)
    config/        Constants (api.config.ts, app.config.constants.ts)
  layouts/         store-layout.ts (customer navbar/footer), admin-layout.ts
  pages/           Customer pages; pages/admin/ for the admin CRUD panel
```

Routes are declared in `app.routes.ts`: customer routes are nested under
`StoreLayout`, admin routes under `AdminLayout` gated by `adminGuard`;
`checkout`, `mis-pedidos`, `perfil` are gated by `authGuard`. Guards redirect to
`/login`, or to `/` if a non-admin hits `/admin`.

### Frontend data flow (cart is the only thing still local)

`AuthService`, `ProductService` and `OrderService` all talk to the real
backend; `core/interceptors/auth.interceptor.ts` attaches `Authorization:
Bearer <token>` to API requests and logs out on a 401.

- `AuthService` (`ec_session` in localStorage, just the JWT + current user for
  instant hydration on reload): `login()` does `POST /auth/login` then
  `GET /auth/me`.
- `ProductService`: loads the catalog once into a `products` signal
  (`GET /products` on construction) and does `getById` against that in-memory
  list rather than re-fetching; `create`/`update`/`remove` hit the admin CRUD
  endpoints and patch the signal with the response.
- `OrderService`: no local cache beyond the `orders` signal it's told to
  populate — `loadMine()`/`loadAll()` (`GET /orders/me` vs. the admin-only
  `GET /orders`) are called explicitly by whichever page needs them
  (`orders.page.ts`, `admin-orders.page.ts`, `admin-dashboard.page.ts`).
  `place()` posts to `POST /orders`; the backend derives the buyer from the
  JWT, not from a client-supplied id.
- `CartService` (`ec_cart` in localStorage) is the one exception: the cart
  stays client-side and per-browser by design (see "Out of scope"). At
  checkout its items are sent as-is in the `POST /orders` body.

If migrating the cart to the backend too, follow `OrderService` as the
reference pattern and add a `cart` module under `backend/app/modules/`.

### Order notifications (no push, no WhatsApp API)

Orders placed at `/checkout` are persisted in Postgres and show up in
`/admin/pedidos` from any device once the admin (re)loads that page — but
there's no push: the admin isn't notified in real time, they have to go look.
To close that gap, checkout also builds a `wa.me` link ("Enviar pedido por
WhatsApp") prefilled with the order details, since a browser can't send
WhatsApp messages on its own without the WhatsApp Business API + a backend
integration for it. Admin's WhatsApp number is `ADMIN_WHATSAPP` in
`src/app/core/config/app.config.constants.ts`.

## Out of scope (current prototype)

- Real payments (checkout only records the order).
- Admin-uploaded product images (URL-only).
- Automatic WhatsApp sending without a backend.
- Cross-device cart sync (still `localStorage`-only, unlike catalog/orders/login
  which are backed by Postgres now).
- Automated tests.
