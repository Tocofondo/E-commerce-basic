# Backend

Todavía no hay API: por ahora esta carpeta solo trae la infraestructura de base de datos
(PostgreSQL + pgAdmin) vía Docker Compose, lista para cuando se agregue el servicio.

## Cómo levantarlo

```bash
cp .env.example .env   # ajustar credenciales si hace falta
docker compose up -d
```

- **PostgreSQL** → `localhost:5432` (usuario/clave/db definidos en `.env`)
- **pgAdmin** → http://localhost:5050 (login con `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`)

Para conectar pgAdmin a Postgres, agregar un servidor nuevo con:
- Host: `postgres` (nombre del servicio en la red de Docker Compose)
- Port: `5432`
- Usuario/clave: los mismos de `POSTGRES_USER` / `POSTGRES_PASSWORD`

## Apagar

```bash
docker compose down        # mantiene los datos (volúmenes)
docker compose down -v     # borra también los datos
```
