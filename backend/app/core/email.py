"""Envío de emails transaccionales: reset de contraseña, avisos de pedidos y
constancia del botón de arrepentimiento.

Sin dependencias externas: usa `smtplib`/`email` de la stdlib. Si no hay un
SMTP configurado (`settings.SMTP_HOST` vacío, el default fuera de producción),
no se manda nada de verdad: se loguea el link para poder probar el flujo en
local sin depender de credenciales de correo reales.
"""

import logging
import smtplib
from email.message import EmailMessage
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.formatting import format_pesos

if TYPE_CHECKING:
    from app.modules.orders.models import Order
    from app.modules.withdrawals.models import WithdrawalRequest

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP no configurado (SMTP_HOST vacío): no se envía el email a %s. Contenido:\n%s",
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
        f"Recibimos un pedido para restablecer tu contraseña en {settings.STORE_NAME}.\n\n"
        f"Hacé click en este link para elegir una nueva contraseña (válido por "
        "30 minutos):\n"
        f"{reset_link}\n\n"
        "Si no fuiste vos, ignorá este email."
    )
    _send(to_email, f"Restablecer tu contraseña - {settings.STORE_NAME}", body)


def _order_summary(order: "Order") -> str:
    items = "\n".join(
        f"- {item.qty}x {item.product_name} ({format_pesos(item.unit_price)} c/u)"
        for item in order.items
    )
    return (
        f"{items}\n"
        f"Total: {format_pesos(order.total)}\n\n"
        f"Envío a: {order.shipping_full_name}\n"
        f"{order.shipping_address}, {order.shipping_city} (CP {order.shipping_postal_code})\n"
        f"Teléfono: {order.shipping_phone}"
    )


def build_order_emails(order: "Order", customer_email: str) -> list[tuple[str, str, str]]:
    """Mails a mandar por un pedido nuevo, como (destinatario, asunto, cuerpo):
    confirmación al cliente y, si hay `ORDER_NOTIFY_EMAIL`, aviso al admin.
    Se arman con el pedido todavía en la sesión; el envío va en background
    (ver orders/router.py) con estos textos ya listos."""
    summary = _order_summary(order)
    emails = [
        (
            customer_email,
            f"Recibimos tu pedido #{order.id} - {settings.STORE_NAME}",
            f"¡Gracias por tu compra en {settings.STORE_NAME}!\n\n"
            f"Tu pedido #{order.id} quedó registrado. Te vamos a escribir para "
            "coordinar el pago y la entrega.\n\n"
            f"{summary}\n\n"
            f"Podés seguirlo en {settings.FRONTEND_URL}/mis-pedidos",
        )
    ]
    if settings.ORDER_NOTIFY_EMAIL:
        emails.append(
            (
                settings.ORDER_NOTIFY_EMAIL,
                f"Nuevo pedido #{order.id} - {settings.STORE_NAME}",
                f"Entró el pedido #{order.id} de {customer_email}.\n\n"
                f"{summary}\n\n"
                f"Gestionalo en {settings.FRONTEND_URL}/admin/pedidos",
            )
        )
    return emails


def build_withdrawal_emails(request: "WithdrawalRequest") -> list[tuple[str, str, str]]:
    """Constancia con el código de trámite para quien pidió revocar la compra
    y, si hay `ORDER_NOTIFY_EMAIL`, aviso al admin."""
    details = (
        f"Código de trámite: {request.code}\n"
        f"Pedido: {request.order_number}\n"
        f"Nombre: {request.full_name}\n"
        f"Email: {request.email}\n"
        f"Teléfono: {request.phone}\n"
        f"Motivo: {request.reason or '(sin especificar)'}"
    )
    # Al cliente solo el código, sin los textos del form: el alta es pública
    # y si no, cualquiera podría usarla para mandar su texto a una casilla
    # ajena desde nuestro SMTP. El detalle completo va solo al admin.
    emails = [
        (
            request.email,
            f"Recibimos tu pedido de arrepentimiento {request.code} - {settings.STORE_NAME}",
            f"Recibimos tu pedido para revocar la compra. Guardá este código: es tu "
            f"constancia del trámite.\n\nCódigo de trámite: {request.code}\n\n"
            "Te vamos a contactar para coordinar la devolución.",
        )
    ]
    if settings.ORDER_NOTIFY_EMAIL:
        emails.append(
            (
                settings.ORDER_NOTIFY_EMAIL,
                f"Arrepentimiento {request.code} - {settings.STORE_NAME}",
                f"Entró un pedido de arrepentimiento.\n\n{details}\n\n"
                f"Gestionalo en {settings.FRONTEND_URL}/admin/arrepentimientos",
            )
        )
    return emails


def send_email_safe(to_email: str, subject: str, body: str) -> None:
    """Para BackgroundTasks: un SMTP caído no tiene que romper nada que ya
    se respondió; queda en el log."""
    try:
        _send(to_email, subject, body)
    except Exception:
        logger.exception("No se pudo enviar el email '%s' a %s", subject, to_email)
