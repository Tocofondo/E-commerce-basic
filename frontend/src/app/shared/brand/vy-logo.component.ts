import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type VyLogoVariante = 'principal' | 'horizontal' | 'icono';
export type VyLogoFondo = 'oscuro' | 'claro';

/**
 * Logo de VACONYAPA.
 *
 * <vy-logo />                                        horizontal, para fondo oscuro, 40px de alto
 * <vy-logo variante="principal" alto="160px" />      con el círculo de la yapa arriba
 * <vy-logo variante="icono" alto="32px" />           solo el círculo con el +
 * <vy-logo fondo="claro" />                          para secciones con fondo blanco
 *
 * Los SVG están en public/brand/logos.
 */
@Component({
  selector: 'vy-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="src" alt="VACONYAPA" [style.height]="alto" decoding="async" />`,
  styles: [
    `
      :host { display: inline-flex; line-height: 0; }
      img { display: block; width: auto; max-width: 100%; }
    `,
  ],
})
export class VyLogoComponent {
  @Input() variante: VyLogoVariante = 'horizontal';
  @Input() fondo: VyLogoFondo = 'oscuro';
  @Input() alto = '40px';

  get src(): string {
    // Relativa al <base href>, para que ande bajo un sub-path (GitHub Pages).
    const base = 'brand/logos/vaconyapa';
    if (this.variante === 'icono') {
      return `${base}-icono-${this.fondo === 'oscuro' ? 'verde' : 'verde-oscuro'}.svg`;
    }
    return `${base}-${this.variante}-fondo-${this.fondo}.svg`;
  }
}
