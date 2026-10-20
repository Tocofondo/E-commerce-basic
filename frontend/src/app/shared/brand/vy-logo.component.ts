import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type VyLogoVariante = 'principal' | 'horizontal' | 'sello' | 'sello-simple';
export type VyLogoFondo = 'oscuro' | 'claro';

/**
 * Logo de VACONYAPA.
 *
 * <vy-logo />                                         horizontal, para fondo oscuro, 40px de alto
 * <vy-logo variante="principal" alto="160px" />       sello VCY arriba, nombre y subrayado
 * <vy-logo variante="sello" alto="64px" />            sello VCY con las rayitas
 * <vy-logo variante="sello-simple" alto="40px" />     sello VCY sin rayitas (para tamaños chicos)
 * <vy-logo fondo="claro" />                           para secciones con fondo blanco
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
    return `brand/logos/vaconyapa-${this.variante}-fondo-${this.fondo}.svg`;
  }
}
