# Imagen del frontend para producción: compila Angular y lo sirve con Caddy,
# que además hace de reverse proxy hacia el backend y saca el certificado
# HTTPS solo. El Caddyfile se monta desde deploy/ (ver deploy/docker-compose.yml).

FROM node:24-alpine AS build
WORKDIR /app

# Solo los manifests primero: si cambia el código pero no las dependencias,
# la capa de `npm ci` queda cacheada.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist/E-commerce-basic/browser /srv
