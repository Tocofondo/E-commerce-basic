"""Formato de montos para textos (emails), como los muestra la tienda:
`$ 18.999` o `$ 18.999,50`."""

from decimal import Decimal


def format_pesos(amount: Decimal | float) -> str:
    value = Decimal(str(amount)).quantize(Decimal("0.01"))
    text = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if text.endswith(",00"):
        text = text[:-3]
    return f"$ {text}"
