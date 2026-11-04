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
- Tests: `uv run pytest` (needs the Postgres from `docker compose up -d`). They
  run against a separate `ecommerce_test` DB (created if missing; the fixtures
  refuse any DB not ending in `_test`, since they drop its schema) built with
  `alembic upgrade head`, so they also catch broken migrations. Emails are
  captured via the `sent_emails` fixture. Helpers live in `tests/conftest.py`.
- Lint/format: `uv run ruff check app alembic tests` and `uv run ruff format
  app alembic tests` (config in `pyproject.toml`).
- CI: `.github/workflows/ci.yml` runs on pushes to `main` and on every PR: backend
  (ruff, `alembic upgrade head`, pytest against a Postgres service) and
  frontend (`npm ci && npm run build`). Editing it needs a `workflow`-scoped
  token to push.

### Frontend (`frontend/`)

Requires Node v22.22.3 / v24.15.0 / v26.0.0+ (Angular CLI 22 minimum). Use `nvm`
if the installed Node is older.

```bash
npm install
npm start           # ng serve, http://localhost:4200
npm run build        # ng build
npm test             # ng test (no spec files exist yet)
```

The API base URL comes from `src/environments/`: `environment.development.ts`
(`http://localhost:8000/api/v1`, used by `npm start` via `fileReplacements`)
and `environment.ts` (`/api/v1`, relative, used by `npm run build` — in
production Caddy serves frontend and API from the same domain). No eslint
config is set up; `.prettierrc` governs formatting.

### Production deploy (`deploy/`, see `DEPLOY.md`)

Single-server stack: `deploy/docker-compose.yml` runs `web` (Caddy built from
`frontend/Dockerfile`, serves the Angular build and proxies `/api/*`,
`/static/*`, `/health` to the backend), `backend` (`backend/Dockerfile`, runs
`alembic upgrade head` on start) and `postgres`. Only Caddy publishes ports.
Config lives in `deploy/.env` (from `deploy/.env.example`, git-ignored); the
compose file forces `ENVIRONMENT=production` and derives `FRONTEND_URL`,
`BACKEND_PUBLIC_URL` and `CORS_ORIGINS` from `PUBLIC_URL`. With
`ENVIRONMENT=production` the API refuses to start with the default
`SECRET_KEY` and disables `/docs`/`/redoc`/`/openapi.json`.

```bash
cd deploy && docker compose up -d --build
docker compose exec backend uv run python -m app.core.db.create_admin   # first admin
./backup.sh                                                              # pg_dump + static images
```

### Accounts

`SEED_USERS` in `backend/app/core/db/seed.py` is empty by default — no demo
accounts are seeded, so the app behaves like a real prod deployment: customers
sign up for real at `/register` (`POST /auth/register`, always role
`"customer"`). To bootstrap an admin, run `uv run python -m
app.core.db.create_admin` (interactive; promotes an existing customer if the
email is taken), or locally add a tuple to `SEED_USERS` in the git-ignored
`app/core/db/seed_local.py` and run the seed — there is no public endpoint
that can create an admin.

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
                properties on the ORM model, not stored as-is). Edits are
                `PATCH /products/{id}` and partial (`exclude_unset`): an
                absent field is kept, an explicit `null` clears it. Images:
                see "Product images" below. Money columns are `Numeric(12, 2)` + `Decimal`
                (`core/money.py`'s `Money` type still serializes as a JSON
                number). `DELETE` is a soft delete (`is_active = false`,
                "pausar" in the admin): files are kept and paused products
                drop out of `GET /products`/ordering; `GET /products/all`
                (admin) includes them.
    orders/     order placement + admin status updates. `OrderItem` snapshots
                product name/image path/price at purchase time (survives the
                product being edited or paused later); `create_order`
                locks the product rows (`SELECT ... FOR UPDATE`, see
                `_lock_products`) before checking/decrementing stock, so
                concurrent orders can't oversell. Status changes follow
                `ALLOWED_TRANSITIONS` (mirrored in the frontend's
                `order.service.ts`); `cancelado`/`entregado` are final and
                cancelling restocks the items. `POST /orders` also accepts
                guests (no token, `get_optional_active_user`; an invalid
                token is still 401): `user_id` is NULL, contact is the
                `email` in the body and/or `shipping.phone` (at least one,
                `ck_orders_contact`), rate-limited per IP. `customer_email`
                is stored on the order (account email when logged in).
                A logged-in customer can cancel their own order while it's
                `pendiente` (`POST /orders/{id}/cancel`, restocks, emails
                `ORDER_NOTIFY_EMAIL`); guests ask by WhatsApp
    promotions/ automatic promotions, coupons and referrals — see
                "Promotions, coupons & referrals" below
    withdrawals/ "botón de arrepentimiento" (Res. 424/2020): public
                `POST /withdrawals` (no login) returns a tracking code and
                emails it; admin lists/resolves them at
                `/admin/arrepentimientos`
  main.py     create_app(): FastAPI instance, CORS, /health
alembic/      migrations; DB URL comes from app.core.config.settings, not
              alembic.ini directly
```

### Promotions, coupons & referrals

`modules/promotions/`, admin UI at `/admin/promociones`.

- `pricing.py` is pure (no DB): `price(lines, promotions, coupon)`. Order:
  (1) per line, the *best* `kind="product"` promotion that applies (scope =
  all / `category` (case-insensitive) / `product_id`, plus `min_qty` units
  *of that same product*) — line promos never stack; (2) the best
  `kind="order"` promotion whose `min_amount` the subtotal *after* step 1
  reaches; (3) the coupon on what's left. Each step rounds to cents.
- `orders/service.py` uses it in two places so the customer sees what gets
  charged: `quote_order` (`POST /orders/quote`, public, no stock lock; an
  invalid coupon returns the quote without it + `couponError`; rate-limited
  per IP when a code is sent) and `create_order` (invalid coupon → 400).
  Orders store `subtotal`, `discount_total`, `total`, a `discounts` JSONB
  snapshot `[{label, amount}]` and `coupon_id`/`coupon_code`.
- Coupons (`resolve_coupon`): active, not expired, `uses < max_uses`, once
  per buyer (account, or contact email for guests; cancelled orders don't
  count), personal ones (`owner_id`) only for that logged-in user, optional
  `min_amount` against the post-promotion subtotal. Locked `FOR UPDATE` when
  placing the order; `uses` is incremented then and decremented
  (`release_coupon`) when the order is cancelled by admin or customer.
- Referrals (logged-in customers only): every `User` has a `referral_code`
  (column default `new_referral_code`); `POST /auth/register` accepts
  `referral_code` (unknown ones are ignored) and sets `referred_by_id`. When
  the admin moves an order to `entregado`, `grant_referral_reward` gives the
  referrer a personal one-use coupon (`REFERRAL_REWARD_PERCENT`, valid
  `REFERRAL_REWARD_DAYS`) — once per invited user (`referral_rewarded_at`),
  and emails it. Profile page shows the invite link (`/register?ref=CODE`),
  stats (`GET /promotions/referrals/me`) and the user's coupons
  (`GET /promotions/coupons/me`); checkout offers them with one tap.
- Frontend: `PromotionService` (+ `cartQuote()`, a debounced quote signal
  used by cart and checkout); the product page shows applicable active
  promotions (`GET /promotions/active`).

### Product images

Uploaded by the admin from the product form (`admin-product-form.page.ts`)
and stored on the backend's disk — no external storage/CDN. Every upload is
re-encoded, never stored as sent:

- Browser first (`core/image-upload.ts`, `prepareImageForUpload`): downscales
  to 2400px and re-encodes to WEBP (JPEG on browsers that can't) so phone
  uploads are fast; also converts formats the browser can decode but the
  backend rejects (HEIC on Safari). GIFs and already-small images go as-is.
  The form has drag & drop, ◀/▶/★ to reorder or pick the cover (saved at once
  via `PUT .../images/order` for uploaded ones; pending ones upload in grid
  order on save) and an upload progress bar (`reportProgress`).
- `POST /products/{id}/images` (admin, multipart `files`) →
  `add_product_images` in `products/service.py`, all-or-nothing per batch.
  `products/images.py` (`process_image`, Pillow, no DB/FastAPI) decodes
  the whole file — the format is detected from content (JPEG/PNG/WEBP/GIF),
  the client's content-type is ignored — caps pixels (`MAX_PIXELS`), applies
  EXIF orientation, drops all metadata (phone photos carry GPS), and writes
  two WEBPs: `<uuid>.webp` (≤1600px, `FULL_MAX_SIDE`) and `<uuid>-thumb.webp`
  (≤640px, `THUMB_MAX_SIDE`). Max original size `MAX_IMAGE_SIZE_MB` (15);
  `MAX_IMAGES_PER_PRODUCT` (4). If writing/committing fails, files already
  written are removed.
- On disk: `settings.STATIC_DIR/products/<product_id>/`; the UUID is the
  `ProductImage.id` (not guessable), never the client's filename. `main.py`
  mounts `STATIC_DIR` at `/static` with `ImmutableStaticFiles`
  (`Cache-Control: immutable`, 1 year — safe because every upload is a new
  name). Locally `backend/static/` (git-ignored); in production the
  `static_data` volume (proxied by Caddy, included in `backup.sh`).
- `product_images` rows: `filename`, `thumb_filename`, `width`/`height` of
  the full one, `position`. The last three are NULL for images uploaded
  before processing existed; `python -m app.modules.products.reprocess_images`
  converts them (idempotent, keeps originals referenced by orders). Until
  then `thumbUrl` = `url` and there's no `srcset`.
- API: each image has `url`, `thumbUrl`, `width`, `height`, `position`;
  products also get `image` (cover, full) and `thumb` (cover, small) — first
  by `position`, `""` if none (frontend falls back to
  `PRODUCT_IMAGE_PLACEHOLDER`). The DB stores relative paths and responses
  make them absolute with `core/urls.py`'s `public_url` (`BACKEND_PUBLIC_URL`).
- Frontend display: cards, cart and admin lists use `thumb || image` (old
  cart copies in localStorage may lack `thumb`); cards and the product detail
  use `productSrcset` (`shared/store/product-image.ts`, real widths so
  portrait images don't pick a too-small thumb) + `sizes`.
- Orders snapshot the cover's `thumb_path` (`OrderItem.product_image`).
  `DELETE /products/{id}/images/{image_id}` removes the row and both files,
  except files an order references; pausing a product keeps all files.

Any new business module (cart, reviews, ...) should follow the same
`models.py` + `schemas.py` + `service.py` + `router.py` shape as the existing
modules and get wired into `app/api/v1/router.py`.

Auth specifics: `role` (`"customer"` | `"admin"`) is never accepted from the
public `/auth/register` endpoint — only server-side code (e.g. the seed) can
create an admin. Emails are always stored lowercase (`NormalizedEmail` in
`auth/schemas.py`, `get_user_by_email` normalizes too, DB `CHECK` enforces
it). Every JWT carries `pwd`, a fingerprint of the current password hash
(`core/security.password_fingerprint`): changing the password revokes all
existing sessions and makes a reset link single-use; reset tokens (with
`scope`) are rejected as access tokens. `/auth/login`, `/auth/register` and
`/auth/forgot-password` are rate-limited in-process (`core/rate_limit.py`,
single uvicorn process; `RATE_LIMIT_ENABLED=false` to turn off); the reset
email is sent via `BackgroundTasks`. `/auth/login` is form-encoded (`OAuth2PasswordRequestForm`,
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
  shared/brand/   VACONYAPA brand kit components (vy-logo with
                   `sello`/`sello-simple` variants for the VCY seal — the old
                   circle-with-a-plus `vy-yapa` is gone, the brand forbids it —
                   vy-product-card, brand-demo at /marca). Global `vy-*`
                   classes + `--vy-*` tokens come from src/styles/vaconyapa/,
                   loaded through src/brand.scss (separate `styles` entry in
                   angular.json — Tailwind v4 doesn't go through Sass). The
                   kit's dark `_base.scss` is NOT applied globally (admin is
                   light); the store gets `.vy-oscuro .vy-tienda` (see
                   brand.scss). Keep asset paths relative (no leading `/`) so
                   the build works under any `--base-href`.
  shared/store/    Store pieces: store-product-card, `pesos` pipe,
                   app-social-icon (inline Simple Icons SVGs for the footer)
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
`StoreLayout`, admin routes (lazy, `loadComponent`, so the store bundle
doesn't ship them) under `AdminLayout` gated by `adminGuard`;
`mis-pedidos`, `perfil` are gated by `authGuard` (`checkout` is not: guests
can buy). Guards redirect to
`/login`, or to `/` if a non-admin hits `/admin`.

### Frontend data flow (cart is the only thing still local)

`AuthService`, `ProductService` and `OrderService` all talk to the real
backend; `core/interceptors/auth.interceptor.ts` attaches `Authorization:
Bearer <token>` to API requests and logs out on a 401.

- `AuthService` (`ec_session` in localStorage, just the JWT + current user for
  instant hydration on reload): `login()` does `POST /auth/login` then
  `GET /auth/me`.
- `ProductService`: loads the catalog into `allProducts` (`GET /products`,
  or `GET /products/all` with paused ones when the user is admin; reloads when
  that changes) and exposes `products`, the active-only catalog the store and
  cart use. `getById` looks in `products`, `getAnyById` (admin) in
  `allProducts`, no re-fetching; `create`/`update`/`pause`/`reactivate` hit
  the admin CRUD endpoints and patch the signal with the response. `refresh()` never
  rejects: pages read `loaded()` (until true, "not in `products`" means "not
  loaded yet", not "doesn't exist") and `error()` to show a spinner or a
  retry button. `core/http-error.ts` (`apiErrorMessage`) turns HTTP errors
  into user-facing text, preferring the backend's `detail`.
- `OrderService`: no local cache beyond the `orders` signal it's told to
  populate — `loadMine()`/`loadAll()` (`GET /orders/me` vs. the admin-only
  `GET /orders`) are called explicitly by whichever page needs them
  (`orders.page.ts`, `admin-orders.page.ts`, `admin-dashboard.page.ts`).
  `place()` posts to `POST /orders`; the backend derives the buyer from the
  JWT, not from a client-supplied id (no JWT = guest order, with the
  `email` passed to `place()`).
- `CartService` (`ec_cart` in localStorage) is the one exception: the cart
  stays client-side and per-browser by design (see "Out of scope"). The
  stored product copies may be stale, so `items` swaps each one for the
  fresh product from `ProductService` once the catalog is loaded (dropping
  deleted ones); `add`/`setQty` cap quantities at stock and `overStock`
  blocks checkout. At checkout its items are sent in the `POST /orders` body
  (only `productId` + `qty`; the backend prices them).

If migrating the cart to the backend too, follow `OrderService` as the
reference pattern and add a `cart` module under `backend/app/modules/`.

### Order notifications (no push, no WhatsApp API)

Orders placed at `/checkout` are persisted in Postgres and show up in
`/admin/pedidos` from any device once the admin (re)loads that page — but
there's no push: the admin isn't notified in real time, they have to go look.
To close that gap, checkout redirects to a `wa.me` link (also offered as an
"Enviar pedido por WhatsApp" button) prefilled with the order details, since a browser can't send
WhatsApp messages on its own without the WhatsApp Business API + a backend
integration for it. Admin's WhatsApp number is `ADMIN_WHATSAPP` in
`src/app/core/config/app.config.constants.ts`; while it's the placeholder,
every WhatsApp button/redirect is hidden (`WhatsappService.adminConfigured`).
The same file holds `SOCIAL_LINKS` (Instagram/TikTok/Facebook icons in the
store footer, hidden while `href` is empty; the WhatsApp icon comes from
`ADMIN_WHATSAPP`) and `SELLER` (legal seller data, still `COMPLETAR`).

## Out of scope (current prototype)

- Real payments (checkout only records the order).
- Fixed-amount ($) discounts: promotions and coupons are percentage-only.
- Automatic WhatsApp sending without a backend.
- Cross-device cart sync (still `localStorage`-only, unlike catalog/orders/login
  which are backed by Postgres now).
- Frontend unit tests (no specs yet; CI only checks that it builds).
