import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { VyYapaComponent } from './vy-yapa.component';

export interface VyProducto {
  id: string;
  nombre: string;
  precio: number;          // en pesos
  precioAnterior?: number; // para mostrar descuento
  imagen?: string;
  conYapa?: boolean;       // lleva regalo
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/**
 * Tarjeta de producto con la estética de la marca:
 * foto arriba, nombre a marcador, precio en verde y el sello de yapa al costado.
 *
 * <vy-product-card [producto]="p" (agregar)="carrito.agregar($event)" />
 */
@Component({
  selector: 'vy-product-card',
  standalone: true,
  imports: [VyYapaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="vy-card tarjeta">
      <div class="foto">
        @if (producto.imagen) {
          <img [src]="producto.imagen" [alt]="producto.nombre" loading="lazy" />
        } @else {
          <span class="vy-label">Foto del producto</span>
        }
      </div>
      <div class="info">
        <div class="texto">
          <h3 class="vy-marker nombre">{{ producto.nombre }}</h3>
          @if (producto.precioAnterior) {
            <span class="vy-precio-anterior">{{ formatear(producto.precioAnterior) }}</span>
          }
          <span class="vy-precio">{{ formatear(producto.precio) }}</span>
        </div>
        @if (producto.conYapa) {
          <vy-yapa [tamano]="40" [rayitas]="false" texto="Con yapa" />
        }
      </div>
      <button type="button" class="vy-btn" (click)="agregar.emit(producto)">Agregar al carrito</button>
    </article>
  `,
  styles: [
    `
      :host { display: block; }
      .tarjeta { display: flex; flex-direction: column; height: 100%; }
      .foto {
        aspect-ratio: 1;
        background: var(--vy-negro);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .foto img { width: 100%; height: 100%; object-fit: cover; }
      .info {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--vy-space-3);
        padding: var(--vy-space-4) var(--vy-space-4) var(--vy-space-3);
        flex: 1;
      }
      .texto { display: flex; flex-direction: column; gap: var(--vy-space-1); min-width: 0; }
      .nombre { font-size: var(--vy-fs-lg); line-height: 1.15; }
      .vy-btn { margin: 0 var(--vy-space-4) var(--vy-space-4); }
    `,
  ],
})
export class VyProductCardComponent {
  @Input({ required: true }) producto!: VyProducto;
  @Output() agregar = new EventEmitter<VyProducto>();

  formatear(valor: number): string {
    return pesos.format(valor);
  }
}
