"""Normalización de teléfonos argentinos al formato que necesita `wa.me`:
solo dígitos, internacional, con el 9 de celular (`549` + código de área +
número, 13 dígitos en total).

Acepta lo que la gente escribe de verdad: `+54 9 341 555-1234`,
`0341 15 555-1234`, `(011) 15-5555-1234`, `3415551234`...
El mismo algoritmo está en el frontend (src/app/core/phone.ts).
"""

import re
from typing import Annotated

from pydantic import AfterValidator

INVALID_PHONE_MESSAGE = (
    "Ingresá un celular argentino con código de área, sin 0 ni 15 (ej. 341 555-1234)"
)


def normalize_ar_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("54"):
        national = digits[2:]
        if national.startswith("9"):
            national = national[1:]
    else:
        national = digits
    if national.startswith("0"):
        national = national[1:]

    # Código de área + "15" + número local: el 15 sobra en formato
    # internacional. El código de área es de 2 (11, AMBA), 3 o 4 dígitos.
    if len(national) == 12:
        for area_len in [2] if national.startswith("11") else [3, 4]:
            if national[area_len : area_len + 2] == "15":
                national = national[:area_len] + national[area_len + 2 :]
                break

    # Código de área + número local siempre suman 10 dígitos.
    if len(national) != 10 or national.startswith("0"):
        raise ValueError(INVALID_PHONE_MESSAGE)
    return "549" + national


# Usar este tipo en todo schema que reciba un teléfono de cliente.
ArPhone = Annotated[str, AfterValidator(normalize_ar_phone)]
