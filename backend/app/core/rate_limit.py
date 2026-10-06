"""Límite de intentos por clave (IP, email...) con ventana deslizante.

En memoria del proceso: alcanza para el deploy actual (un solo proceso de
uvicorn, ver deploy/). Si algún día se corren varios workers o réplicas, cada
uno llevaría su propia cuenta y habría que moverlo a Redis.

Detrás de Caddy la IP real del cliente llega en `X-Forwarded-For`; uvicorn la
usa como `request.client.host` porque deploy/docker-compose.yml define
`FORWARDED_ALLOW_IPS`.
"""

import math
import threading
import time
from collections import deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

# Por encima de esta cantidad de claves se barren las que ya no tienen hits
# en ventana, para que la memoria no crezca sin límite.
_SWEEP_THRESHOLD = 10_000


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, window: float, now: float) -> deque[float]:
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - window:
            hits.popleft()
        return hits

    def retry_after(self, key: str, limit: int, window: float) -> float | None:
        """Segundos a esperar si `key` ya llegó a `limit` hits en la ventana,
        o None si todavía puede."""
        now = time.monotonic()
        with self._lock:
            hits = self._recent(key, window, now)
            if len(hits) < limit:
                return None
            return hits[0] + window - now

    def record(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._hits.setdefault(key, deque()).append(now)
            if len(self._hits) > _SWEEP_THRESHOLD:
                self._sweep(now)

    def _sweep(self, now: float) -> None:
        # La ventana más larga que se usa es de 1 hora.
        for key in [k for k, hits in self._hits.items() if not hits or hits[-1] <= now - 3600]:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def ensure_not_limited(key: str, limit: int, window_seconds: int) -> None:
    """429 si `key` ya agotó sus intentos. No registra un intento nuevo:
    eso lo decide quien llama (ej. el login solo cuenta los fallidos)."""
    if not settings.RATE_LIMIT_ENABLED:
        return
    wait = limiter.retry_after(key, limit, window_seconds)
    if wait is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Esperá unos minutos y probá de nuevo.",
            headers={"Retry-After": str(max(1, math.ceil(wait)))},
        )


def record(key: str) -> None:
    """Registra un intento sin chequear (para contar solo ciertos casos)."""
    if settings.RATE_LIMIT_ENABLED:
        limiter.record(key)


def hit(key: str, limit: int, window_seconds: int) -> None:
    """Chequea el límite y registra el intento (el caso común)."""
    ensure_not_limited(key, limit, window_seconds)
    record(key)
