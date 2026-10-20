import { Pipe, PipeTransform } from '@angular/core';

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/** Precio en pesos sin centavos, como en el kit de marca: `{{ 15000 | pesos }}` → "$ 15.000". */
@Pipe({ name: 'pesos', standalone: true })
export class PesosPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '' : pesos.format(value);
  }
}
