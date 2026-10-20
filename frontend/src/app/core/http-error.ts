import { HttpErrorResponse } from '@angular/common/http';

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con la tienda. Revisá tu conexión y probá de nuevo.';

/** True si el request ni siquiera llegó al backend (sin red, backend caído). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 502);
}

/**
 * Mensaje para mostrarle al usuario a partir de un error HTTP: el `detail`
 * del backend cuando es un texto pensado para eso (FastAPI lo usa en los
 * 400/404/409/429 propios, ej. "No hay stock suficiente de ..."), un aviso
 * de conexión si no hubo respuesta, o el `fallback`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isNetworkError(err)) return NETWORK_ERROR_MESSAGE;
  if (err instanceof HttpErrorResponse && typeof err.error?.detail === 'string') {
    return err.error.detail;
  }
  // 422 de validación de Pydantic: lista de errores; el primero que traiga un
  // mensaje propio (los `ValueError` del backend, ej. teléfono inválido).
  if (err instanceof HttpErrorResponse && err.status === 422 && Array.isArray(err.error?.detail)) {
    const custom = err.error.detail.find(
      (d: { msg?: unknown }) => typeof d.msg === 'string' && d.msg.startsWith('Value error, '),
    );
    if (custom) return custom.msg.slice('Value error, '.length);
  }
  return fallback;
}
