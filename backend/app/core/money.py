"""Tipo para montos en pesos: `Decimal` con 2 decimales en Python y en la DB
(`Numeric(12, 2)`), para no arrastrar errores de coma flotante (0.1 + 0.2) en
totales y reportes.

En el JSON viaja como número (no como string, que es lo que haría Pydantic
con un `Decimal` por defecto): el frontend lo usa directo como `number`.
"""

from decimal import Decimal
from typing import Annotated

from pydantic import Field, PlainSerializer
from sqlalchemy import Numeric

Money = Annotated[
    Decimal,
    Field(ge=0, max_digits=12, decimal_places=2),
    PlainSerializer(float, return_type=float, when_used="json"),
]

# Columna SQL para cualquier monto.
MONEY_COLUMN = Numeric(12, 2)
