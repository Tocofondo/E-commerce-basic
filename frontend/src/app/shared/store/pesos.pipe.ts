import { Pipe, PipeTransform } from '@angular/core';

// Sin centavos cuando el precio es redondo ("$ 18.999"), con centavos cuando
// los tiene ("$ 149,99"): redondear mostraría otro número que el del total.
const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "$ 15.000": para textos armados en código (ej. el mensaje de WhatsApp). */
export function formatPesos(value: number): string {
  return pesos.format(value);
}

/** Precio en pesos: `{{ 15000 | pesos }}` → "$ 15.000", `{{ 149.99 | pesos }}` → "$ 149,99". */
@Pipe({ name: 'pesos', standalone: true })
export class PesosPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '' : pesos.format(value);
  }
}
