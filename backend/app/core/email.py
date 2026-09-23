"""Envío de emails transaccionales (por ahora, solo el reset de contraseña).

Sin dependencias externas: usa `smtplib`/`email` de la stdlib. Si no hay un
SMTP configurado (`settings.SMTP_HOST` vacío, el default fuera de producción),
no se manda nada de verdad: se loguea el link para poder probar el flujo en
local sin depender de credenciales de correo reales.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP no configurado (SMTP_HOST vacío): no se envía el email a %s. "
            "Contenido:\n%s",
            to_email,
            body,
        )
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)
    logger.info("Email enviado a %s: %s", to_email, subject)


def send_password_reset_email(to_email: str, token: str) -> None:
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    body = (
        "Recibimos un pedido para restablecer tu contraseña en Mi Tienda.\n\n"
        f"Hacé click en este link para elegir una nueva contraseña (válido por "
        "30 minutos):\n"
        f"{reset_link}\n\n"
        "Si no fuiste vos, ignorá este email."
    )
    _send(to_email, "Restablecer tu contraseña - Mi Tienda", body)
