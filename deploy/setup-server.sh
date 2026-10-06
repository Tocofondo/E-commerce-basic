#!/usr/bin/env bash
# Preparación inicial de un servidor Ubuntu 22.04/24.04 recién creado
# (AWS Lightsail u otro VPS). Correr una sola vez:
#   sudo bash deploy/setup-server.sh
#
# Instala Docker, crea swap (con 1-2 GB de RAM el build de Angular la
# necesita) y activa las actualizaciones de seguridad automáticas.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Correr con sudo: sudo bash $0" >&2
  exit 1
fi

TARGET_USER="${SUDO_USER:-ubuntu}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

echo "==> Swap ($SWAP_SIZE)"
if swapon --show | grep -q .; then
  echo "Ya hay swap activa, no se toca."
else
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Docker"
if command -v docker >/dev/null 2>&1; then
  echo "Docker ya está instalado."
else
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$TARGET_USER"

echo "==> Actualizaciones de seguridad automáticas"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades git
dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "Listo. Cerrá la sesión SSH y volvé a entrar para usar docker sin sudo."
