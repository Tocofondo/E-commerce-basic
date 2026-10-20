// Normalización de teléfonos argentinos al formato de `wa.me`: solo dígitos,
// internacional, con el 9 de celular (549 + código de área + número).
// Mismo algoritmo que el backend (backend/app/core/phone.py), que además
// rechaza los inválidos al registrarse y en el checkout.

export const INVALID_PHONE_MESSAGE =
  'Ingresá un celular argentino con código de área, sin 0 ni 15 (ej. 341 555-1234).';

/** `0341 15 555-1234` → `5493415551234`; `null` si no es un número válido. */
export function normalizeArPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  let national = digits;
  if (digits.startsWith('54')) {
    national = digits.slice(2);
    if (national.startsWith('9')) national = national.slice(1);
  }
  if (national.startsWith('0')) national = national.slice(1);

  // Código de área (2, 3 o 4 dígitos) + "15" + número local.
  if (national.length === 12) {
    for (const areaLen of national.startsWith('11') ? [2] : [3, 4]) {
      if (national.slice(areaLen, areaLen + 2) === '15') {
        national = national.slice(0, areaLen) + national.slice(areaLen + 2);
        break;
      }
    }
  }

  if (national.length !== 10 || national.startsWith('0')) return null;
  return '549' + national;
}
