#!/usr/bin/env bash
# Backup de la base de datos y de las imágenes de producto.
#
# Pensado para correr por cron todos los días (ver DEPLOY.md):
#   15 3 * * * /home/ubuntu/E-commerce-basic/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# Deja los archivos en $BACKUP_DIR y borra los de más de $KEEP_DAYS días.
# Ojo: quedan en el mismo servidor; los snapshots automáticos de Lightsail
# (o copiar esta carpeta a otro lado) cubren el caso de perder la máquina.
set -euo pipefail

cd "$(dirname "$0")"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# pg_dump corre dentro del contenedor con sus propias variables de entorno
# (no hace falta exponer el puerto de Postgres ni leer el .env acá).
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "$BACKUP_DIR/db-$STAMP.dump"

docker compose exec -T backend tar -czf - -C /app static \
  > "$BACKUP_DIR/static-$STAMP.tar.gz"

find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'static-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') backup OK: db-$STAMP.dump, static-$STAMP.tar.gz"
