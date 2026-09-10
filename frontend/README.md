# E-commerce Basic — Prototipo

Prototipo navegable de e-commerce hecho en **Angular 22** (standalone components + signals),
sin backend: todos los datos (productos, sesión, carrito, pedidos) viven en memoria y se
persisten en `localStorage` del navegador.

## Cómo correrlo

```bash
npm install
npm start
```

Abrir `http://localhost:4200`.

> Requiere Node **v22.22.3 / v24.15.0 / v26.0.0** o superior (mínimo exigido por Angular CLI 22).
> Si tenés una versión anterior instalada, usá `nvm` para levantar una compatible:
> ```bash
> nvm install 24
> nvm use 24
> npm start
> ```

## Cuentas de prueba

No hay backend de autenticación real: el login valida contra dos usuarios mock.

| Rol      | Email              | Contraseña |
|----------|---------------------|------------|
| Cliente  | `cliente@demo.com`  | `cliente`  |
| Admin    | `admin@demo.com`    | `admin`    |

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

No hay servidor ni base de datos. Cada servicio en `core/services/` mantiene su propio
estado con **signals** de Angular y lo persiste en `localStorage` en cada cambio:

| Servicio            | Guarda en localStorage | Contenido |
|-----------------------|:---:|---|
| `ProductService`      | `ec_products` | Catálogo (con semilla inicial de ~8 productos) |
| `AuthService`         | `ec_session`  | Usuario logueado actualmente |
| `CartService`         | `ec_cart`     | Items del carrito |
| `OrderService`        | `ec_orders`   | Pedidos realizados |

Esto significa que **el catálogo, la sesión, el carrito y los pedidos sobreviven a un
refresh de la página**, pero son locales a cada navegador — no se comparten entre
distintos dispositivos ni usuarios reales.

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

## Fuera de alcance de este prototipo

- Pagos reales (el checkout solo registra el pedido, no cobra).
- Imágenes de producto subidas por el admin (se cargan por URL).
- Envío automático de WhatsApp sin backend (ver sección anterior).
- Sincronización de datos entre distintos dispositivos/usuarios (todo vive en
  `localStorage` local).
- Tests automatizados.

### Si más adelante se agrega backend

Para que pedidos, catálogo y sesión sean reales y compartidos entre dispositivos, el
siguiente paso natural sería:
1. Reemplazar los `Storage`/`localStorage` de cada servicio por llamadas HTTP a una API.
2. Agregar autenticación real (JWT o sesión de servidor) en `AuthService`.
3. Mover el envío de WhatsApp al backend usando la API oficial de WhatsApp Business, o
   a un servicio de notificaciones (email, push) disparado al crear el pedido.
