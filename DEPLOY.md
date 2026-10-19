# Deploy a producción (un solo servidor)

Todo el stack corre en **un VPS con Docker**: Caddy (sirve el frontend y saca
el certificado HTTPS solo), el backend FastAPI y Postgres. Los archivos están
en [`deploy/`](deploy/). La guía usa **AWS Lightsail**, pero sirve igual para
cualquier VPS con Ubuntu (Hetzner, Hostinger, DonWeb, DigitalOcean...): solo
cambian los pasos de la consola del proveedor (puntos 1 y 2).

```
                ┌──────────────────────── servidor ─────────────────────────┐
 navegador ───▶ │ web (Caddy :80/:443)                                      │
                │   /api/*, /static/*, /health ──▶ backend (FastAPI :8000)  │
                │   todo lo demás ──▶ frontend Angular compilado            │
                │                       backend ──▶ postgres (:5432)        │
                └────────────────────────────────────────────────────────────┘
```

Solo Caddy publica puertos; Postgres y el backend no son accesibles desde
afuera. Frontend y API comparten dominio, así que no hace falta CORS y el
build de Angular usa `/api/v1` relativo (`frontend/src/environments/`).

## Antes de empezar (en el repo)

- [ ] Poner el número de WhatsApp real del admin en
      `frontend/src/app/core/config/app.config.constants.ts` (`ADMIN_WHATSAPP`,
      formato internacional sin `+` ni espacios, ej. `5493811234567`) y
      commitearlo.
- [ ] Tener (opcional pero recomendado) un dominio, ej. un `.com.ar` en
      [NIC Argentina](https://nic.ar).

## 1. Crear la instancia (Lightsail)

En la [consola de Lightsail](https://lightsail.aws.amazon.com/):

1. **Create instance** → región **São Paulo (sa-east-1)** (o us-east-1 si
   sale más barato) → plataforma **Linux/Unix** → **OS Only → Ubuntu 24.04
   LTS**.
2. Plan: **2 GB RAM** (el de 1 GB anda muy justo con Postgres + el build).
3. Activar **Automatic snapshots** (backup diario de toda la máquina).
4. Crear.

## 2. Red: IP fija y firewall

1. **Networking → Create static IP** y asignarla a la instancia (gratis
   mientras esté asignada; sin esto la IP cambia al reiniciar).
2. En la pestaña **Networking** de la instancia, firewall IPv4 (y IPv6):
   dejar **SSH (22)**, **HTTP (80)** y agregar **HTTPS (443)**. Nada más.
3. Si tenés dominio: en el DNS de tu proveedor crear un registro **A** para
   `mitienda.com.ar` (y `www` si lo querés) apuntando a la IP estática.
   Esperar a que propague (`dig +short mitienda.com.ar` tiene que devolver
   la IP) **antes** del paso 5, si no Caddy no puede sacar el certificado.

## 3. Preparar el servidor

Conectarse por SSH (botón "Connect using SSH" de Lightsail, o con la key que
se descarga desde *Account → SSH keys*):

```bash
git clone https://github.com/Tocofondo/E-commerce-basic.git
cd E-commerce-basic
sudo bash deploy/setup-server.sh   # Docker + 2 GB de swap + updates automáticos
exit                               # salir y volver a entrar (grupo docker)
```

> Si el repo es privado, `git clone` va a pedir credenciales: usar un
> [token de GitHub](https://github.com/settings/tokens) de solo lectura como
> contraseña, o una deploy key SSH.

## 4. Configurar

```bash
cd ~/E-commerce-basic/deploy
cp .env.example .env
nano .env
```

Completar como mínimo:

| Variable | Valor |
|---|---|
| `SITE_ADDRESS` | `mitienda.com.ar` (o `:80` si todavía no hay dominio) |
| `PUBLIC_URL` | `https://mitienda.com.ar` (o `http://<IP>` sin dominio) |
| `POSTGRES_PASSWORD` | `openssl rand -base64 32 \| tr -d '/+='` |
| `SECRET_KEY` | `openssl rand -base64 48 \| tr -d '/+='` — **obligatorio**, la API no arranca con el default |
| `SMTP_*` | Para que llegue el mail de "olvidé mi contraseña". Vacío = el link solo sale en los logs |

## 5. Levantar

```bash
docker compose up -d --build
docker compose ps                # los 3 servicios "running" / postgres "healthy"
docker compose logs -f backend   # migraciones aplicadas + "iniciada (environment=production)"
```

El primer build tarda varios minutos (compila Angular dentro de Docker). El
backend aplica las migraciones de Alembic solo al arrancar.

Probar: `https://mitienda.com.ar` (o `http://<IP>`) y
`https://mitienda.com.ar/health` → `{"status":"ok"}`.

## 6. Crear el primer admin

No hay endpoint público para crear admins. Con el stack levantado:

```bash
docker compose exec backend uv run python -m app.core.db.create_admin
```

Pide email, teléfono y contraseña. Si el email ya existe como cliente (por
ejemplo, te registraste desde `/register`), ofrece promoverlo a admin.

Después entrar a `/login` y cargar el catálogo desde `/admin/productos`.

> **No** correr `app.core.db.seed` en producción: carga productos de
> ejemplo.

## 7. Backups

`deploy/backup.sh` guarda un dump de Postgres y un `.tar.gz` de las imágenes
de producto en `~/backups`, y borra los de más de 14 días. Programarlo con
cron:

```bash
mkdir -p ~/backups
crontab -e
# agregar:
15 3 * * * /home/ubuntu/E-commerce-basic/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```

Esos archivos quedan en el mismo servidor: los **snapshots automáticos de
Lightsail** (paso 1) cubren el caso de perder la máquina entera. Cada tanto
conviene bajarse una copia (`scp`).

Restaurar la base desde un dump:

```bash
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < ~/backups/db-AAAAMMDD-HHMMSS.dump
```

Restaurar las imágenes:

```bash
docker compose exec -T backend tar -xzf - -C /app < ~/backups/static-AAAAMMDD-HHMMSS.tar.gz
```

## Actualizar a una versión nueva

```bash
cd ~/E-commerce-basic
git pull
cd deploy
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al reiniciar el backend. Antes de
un cambio grande, correr `./backup.sh` a mano.

## Comandos útiles

```bash
docker compose logs -f web            # Caddy (certificados, requests)
docker compose logs -f backend        # API (y links de reset si no hay SMTP)
docker compose restart backend
docker compose exec postgres psql -U ecommerce ecommerce   # consola SQL
docker system prune -f                # liberar disco de builds viejos
```

## Si el servidor tiene poca RAM

El build de Angular dentro de Docker usa bastante memoria. Con la swap de
`setup-server.sh` alcanza en 2 GB; si aun así falla, se puede compilar en otra
máquina (`cd frontend && npm ci && npm run build`) y servir
`frontend/dist/E-commerce-basic/browser` montándolo en el servicio `web` en
lugar de buildear la imagen.

## Costos de referencia (Lightsail)

| Concepto | Costo |
|---|---|
| Instancia 2 GB | ~USD 12/mes |
| IP estática (asignada) | gratis |
| Snapshots automáticos | ~USD 0,05/GB-mes (~USD 1–2) |
| Dominio `.com.ar` | anual, en NIC Argentina |

Las cuentas nuevas de AWS reciben créditos iniciales; elegir el plan
**Paid** para que la cuenta no se cierre cuando se terminen.
