"""Envío de emails transaccionales: reset de contraseña, avisos de pedidos y
constancia del botón de arrepentimiento.

Sin dependencias externas: usa `smtplib`/`email` de la stdlib. Si no hay un
SMTP configurado (`settings.SMTP_HOST` vacío, el default fuera de producción),
no se manda nada de verdad: se loguea el link para poder probar el flujo en
local sin depender de credenciales de correo reales.
"""

import logging
import smtplib
from decimal import Decimal
from email.message import EmailMessage
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.formatting import format_pesos

if TYPE_CHECKING:
    from app.modules.auth.models import User
    from app.modules.orders.models import Order
    from app.modules.promotions.models import Coupon
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
    discounts = "".join(
        f"Descuento {d['label']}: -{format_pesos(Decimal(d['amount']))}\n"
        for d in order.discounts or []
    )
    if discounts:
        discounts = f"Subtotal: {format_pesos(order.subtotal)}\n{discounts}"
    return (
        f"{items}\n"
        f"{discounts}"
        f"Total: {format_pesos(order.total)}\n\n"
        f"Envío a: {order.shipping_full_name}\n"
        f"{order.shipping_address}, {order.shipping_city} (CP {order.shipping_postal_code})\n"
        f"Teléfono: {order.shipping_phone or '(no dejó)'}\n"
        f"Email: {order.customer_email or '(no dejó)'}"
    )


def build_order_emails(order: "Order", *, registered: bool) -> list[tuple[str, str, str]]:
    """Mails a mandar por un pedido nuevo, como (destinatario, asunto, cuerpo):
    confirmación al cliente si dejó email y, si hay `ORDER_NOTIFY_EMAIL`, aviso
    al admin. Se arman con el pedido todavía en la sesión; el envío va en
    background (ver orders/router.py) con estos textos ya listos."""
    summary = _order_summary(order)
    emails = []
    if order.customer_email:
        # Un invitado no tiene "mis pedidos" ni puede cancelar desde la web.
        follow_up = (
            f"Podés seguirlo en {settings.FRONTEND_URL}/mis-pedidos"
            if registered
            else "Si querés cancelarlo o cambiar algo, avisanos por WhatsApp "
            f"con el número de pedido (#{order.id})."
        )
        emails.append(
            (
                order.customer_email,
                f"Recibimos tu pedido #{order.id} - {settings.STORE_NAME}",
                f"¡Gracias por tu compra en {settings.STORE_NAME}!\n\n"
                f"Tu pedido #{order.id} quedó registrado. Te vamos a escribir para "
                "coordinar el pago y la entrega.\n\n"
                f"{summary}\n\n"
                f"{follow_up}",
            )
        )
    if settings.ORDER_NOTIFY_EMAIL:
        buyer = order.customer_email or order.shipping_phone
        if not registered:
            buyer = f"{buyer} (invitado)"
        emails.append(
            (
                settings.ORDER_NOTIFY_EMAIL,
                f"Nuevo pedido #{order.id} - {settings.STORE_NAME}",
                f"Entró el pedido #{order.id} de {buyer}.\n\n"
                f"{summary}\n\n"
                f"Gestionalo en {settings.FRONTEND_URL}/admin/pedidos",
            )
        )
    return emails


def build_order_cancelled_email(order: "Order") -> tuple[str, str, str] | None:
    """Aviso al admin de que el cliente canceló su pedido desde la web, o
    None si no hay `ORDER_NOTIFY_EMAIL`."""
    if not settings.ORDER_NOTIFY_EMAIL:
        return None
    return (
        settings.ORDER_NOTIFY_EMAIL,
        f"Pedido #{order.id} cancelado por el cliente - {settings.STORE_NAME}",
        f"{order.customer_email} canceló el pedido #{order.id}. El stock ya se repuso.\n\n"
        f"{_order_summary(order)}",
    )


def build_referral_reward_email(user: "User", coupon: "Coupon") -> tuple[str, str, str]:
    """Aviso a quien invitó: ganó un cupón para su próxima compra."""
    percent = f"{coupon.percent.normalize():f}%"
    expires = coupon.expires_at.strftime("%d/%m/%Y") if coupon.expires_at else None
    return (
        user.email,
        f"Ganaste un {percent} de descuento - {settings.STORE_NAME}",
        f"¡Gracias por recomendarnos! Alguien que invitaste recibió su primer pedido, "
        f"así que tenés un {percent} de descuento en tu próxima compra.\n\n"
        f"Tu cupón: {coupon.code}\n"
        + (f"Vence el {expires}.\n" if expires else "")
        + "Es personal: usalo ingresando con tu cuenta en el checkout.\n\n"
        f"{settings.FRONTEND_URL}/productos",
    )


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
