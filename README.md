# E-commerce Basic

Monorepo del proyecto.

## Estructura

```
frontend/   Aplicación Angular (ver frontend/README.md para correrla y su documentación)
backend/    API en FastAPI + Postgres/pgAdmin vía Docker Compose (ver backend/README.md)
deploy/     Stack de producción en un solo servidor: Caddy + backend + Postgres (ver DEPLOY.md)
```

## Cómo correr el proyecto

- Frontend: ver [`frontend/README.md`](frontend/README.md).
- Backend (API + base de datos): ver [`backend/README.md`](backend/README.md).
- Producción (VPS / AWS Lightsail): ver [`DEPLOY.md`](DEPLOY.md).
