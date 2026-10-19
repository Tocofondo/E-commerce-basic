import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * El sello de la yapa: círculo con el + y las rayitas, con un texto a marcador opcional.
 * Usalo en productos que llevan regalo, en el carrito o en el checkout.
 *
 * <vy-yapa />                         solo el ícono, 48px
 * <vy-yapa texto="Con yapa" />        ícono + texto debajo
 * <vy-yapa [rayitas]="false" />       sin rayitas (para tamaños chicos)
 */
@Component({
  selector: 'vy-yapa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="tamano * (rayitas ? 200 / 110 : 1)"
      [attr.height]="tamano"
      [attr.viewBox]="rayitas ? '0 0 200 110' : '45 0 110 110'"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="100" cy="55" r="39" stroke-width="6" />
      <path d="M85 55h30M100 40v30" stroke-width="7.5" />
      @if (rayitas) {
        <path
          d="M25.9 19.25L44.1 29.75M14.5 55.5h21M25.9 91.75L44.1 81.25M174.1 19.25L155.9 29.75M185.5 55.5h-21M174.1 91.75L155.9 81.25"
          stroke-width="5"
        />
      }
    </svg>
    @if (texto) {
      <span class="vy-marker">{{ texto }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        color: var(--vy-verde);
      }
      span { font-size: 0.875rem; line-height: 1; }
    `,
  ],
})
export class VyYapaComponent {
  /** Alto del ícono en px. */
  @Input() tamano = 48;
  @Input() rayitas = true;
  @Input() texto = '';
}
