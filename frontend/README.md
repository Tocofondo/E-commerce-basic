# E-commerce Basic — Prototipo

Prototipo navegable de e-commerce hecho en **Angular 22** (standalone components + signals).
El **login es real**, contra la API en FastAPI de `../backend`; el resto de los datos
(productos, carrito, pedidos) todavía vive en memoria y se persiste en `localStorage` del
navegador — ver [`../backend/README.md`](../backend/README.md) para lo ya migrado a backend.

## Cómo correrlo

Necesita el backend arriba para poder loguearse (ver `../backend/README.md`):

```bash
cd ../backend
cp .env.example .env
docker compose up -d                   # Postgres + pgAdmin
uv sync                                 # crea el .venv e instala deps (requiere uv)
uv run alembic upgrade head
uv run python -m app.db.seed            # crea los usuarios de prueba
uv run uvicorn app.main:app --reload    # http://localhost:8000
```

Y en otra terminal, el frontend:

```bash
npm install
npm start
```

Abrir `http://localhost:4200`. La URL de la API está hardcodeada en
`src/app/core/config/api.config.ts` (`http://localhost:8000/api/v1`); si el backend corre en
otro host/puerto, ajustar ahí.

> Requiere Node **v22.22.3 / v24.15.0 / v26.0.0** o superior (mínimo exigido por Angular CLI 22).
> Si tenés una versión anterior instalada, usá `nvm` para levantar una compatible:
> ```bash
> nvm install 24
> nvm use 24
> npm start
> ```

## Cuentas de prueba

Las crea el seed del backend (`uv run python -m app.db.seed`, ver `../backend/README.md`):

| Rol      | Email              | Contraseña   |
|----------|---------------------|--------------|
| Cliente  | `cliente@demo.com`  | `cliente1234`|
| Admin    | `admin@demo.com`    | `admin1234`  |

## Estructura del proyecto

```
src/app/
├── design-system/     Componentes de UI reutilizables (ds-button, ds-card-product, etc.)
│                       No modificar: es la base visual de toda la app.
├── core/
│   ├── models/         Interfaces: Product, User, CartItem, Order
│   ├── services/       Estado de la app (signals) + persistencia en localStorage
│   ├── guards/         Control de acceso a rutas por sesión/rol
│   └── config/         Constantes configurables (ej. número de WhatsApp del admin)
├── layouts/
│   ├── store-layout.ts  Navbar + footer del cliente (envuelve las páginas públicas)
│   └── admin-layout.ts  Sidebar del panel de administración
├── pages/               Páginas del cliente (home, catálogo, carrito, checkout, etc.)
└── pages/admin/         Páginas del panel de administración (CRUD, pedidos)
```

### Rutas

**Tienda (cliente):**

| Ruta                | Página                          | Requiere sesión |
|----------------------|----------------------------------|:---:|
| `/`                  | Home (destacados)                | No |
| `/productos`         | Catálogo (búsqueda + filtro)      | No |
| `/productos/:id`     | Detalle de producto               | No |
| `/carrito`           | Carrito                           | No |
| `/checkout`          | Confirmar pedido                  | Sí |
| `/mis-pedidos`       | Historial de pedidos del cliente  | Sí |
| `/perfil`            | Datos de la cuenta + logout       | Sí |

**Administración:**

| Ruta                       | Página                        | Requiere rol |
|-----------------------------|--------------------------------|:---:|
| `/admin`                    | Dashboard (métricas)           | admin |
| `/admin/productos`          | Listado de productos (CRUD)    | admin |
| `/admin/productos/nuevo`    | Alta de producto                | admin |
| `/admin/productos/:id`      | Edición de producto             | admin |
| `/admin/pedidos`            | Listado de pedidos + cambio de estado | admin |

Las rutas protegidas usan guards (`core/guards/auth.guard.ts` y `admin.guard.ts`) que
redirigen a `/login` (o a `/` si un cliente intenta entrar a `/admin`).

## Cómo fluyen los datos

`AuthService` es el único que habla con un backend real: `login()` hace `POST /auth/login`
+ `GET /auth/me` contra la API de FastAPI (ver `core/interceptors/auth.interceptor.ts`, que
agrega el `Authorization: Bearer <token>` a los pedidos hacia la API y desloguea si el
backend responde 401). El resto de los servicios en `core/services/` todavía mantiene su
propio estado con **signals** de Angular y lo persiste en `localStorage`:

| Servicio            | Guarda en localStorage | Contenido |
|-----------------------|:---:|---|
| `ProductService`      | `ec_products` | Catálogo (con semilla inicial de ~8 productos) |
| `AuthService`         | `ec_session`  | Token JWT + usuario actual (viene del backend) |
| `CartService`         | `ec_cart`     | Items del carrito |
| `OrderService`        | `ec_orders`   | Pedidos realizados |

Esto significa que **la sesión es real y validada por el backend en cada login**, pero el
catálogo, el carrito y los pedidos siguen siendo locales a cada navegador — no se comparten
entre distintos dispositivos ni usuarios reales (todavía).

## Cómo se entera el admin de un pedido nuevo

Hay dos vías, pensadas para un prototipo sin backend:

### 1. Panel de administración (automático)

Todos los pedidos quedan guardados en `localStorage` (`ec_orders`) apenas el cliente
confirma la compra en `/checkout`. El admin los ve en tiempo real en **`/admin/pedidos`**
sin ninguna acción extra, con su estado (`pendiente`, `pagado`, `enviado`, `entregado`,
`cancelado`) editable desde un `<select>`.

> Importante: como no hay backend, esto funciona **en el mismo navegador**. Si el cliente
> compra desde su celular y el admin mira `/admin` desde otra computadora, el admin no va
> a ver ese pedido — cada dispositivo tiene su propio `localStorage`. Para que ambos vean
> los mismos pedidos en dispositivos distintos hace falta un backend real (ver más abajo).

### 2. Aviso por WhatsApp (manual, un clic)

Al confirmar el pedido en `/checkout`, aparece un botón **"Enviar pedido por WhatsApp"**
que abre `https://wa.me/...` con el detalle del pedido (productos, total, datos de envío)
ya escrito en el mensaje — el cliente solo tiene que apretar "Enviar" en WhatsApp. Este
mensaje va al número del admin (`ADMIN_WHATSAPP`).

El checkout pide además el **teléfono del cliente** como dato de envío. Con ese dato, en
`/admin/pedidos` (columna "Teléfono") el admin tiene un botón **"Contactar cliente"** que
abre `https://wa.me/...` directo al número del cliente, para coordinar el pedido.

**Por qué es así y no 100% automático:** enviar un WhatsApp sin que nadie haga clic
requiere la API de WhatsApp Business (Meta) con credenciales y un backend que la invoque
— un navegador no puede mandar mensajes de WhatsApp por su cuenta ni con JavaScript
plano. El link `wa.me` es la única forma de integrar WhatsApp sin backend ni costos.

**Configurar el número del admin:** editar la constante en
`src/app/core/config/app.config.constants.ts`:

```ts
export const ADMIN_WHATSAPP = '549XXXXXXXXXX'; // formato internacional, sin "+" ni espacios
```

## Design system

Todos los componentes visuales (`ds-button`, `ds-input`, `ds-card-product`, `ds-navbar`,
etc.) están en `src/app/design-system/` y son reutilizables. Para rebrandear los colores
de toda la app alcanza con editar `src/theme/palette.css` (variables CSS `--brand-*`).

## Fuera de alcance de este prototipo (por ahora)

- Pagos reales (el checkout solo registra el pedido, no cobra).
- Imágenes de producto subidas por el admin (se cargan por URL).
- Envío automático de WhatsApp sin backend (ver sección anterior).
- Sincronización de catálogo/carrito/pedidos entre distintos dispositivos/usuarios (todavía
  viven en `localStorage` local — el login ya no).
- Tests automatizados.

### Próximos pasos (migrar el resto al backend)

El login ya sale de `../backend` (FastAPI + Postgres). Para que catálogo, carrito y pedidos
sean reales y compartidos entre dispositivos, el siguiente paso natural es agregar esos
módulos de negocio en `backend/app/modules/` (mismo patrón que `auth`: models + schemas +
service + router) y reemplazar el `Storage`/`localStorage` de cada servicio del frontend por
llamadas HTTP a esa API — `AuthService` ya sirve de referencia de cómo hacerlo.
