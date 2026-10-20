import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../core/models/product.model';
import { PesosPipe } from './pesos.pipe';

/**
 * Tarjeta de producto de la tienda, con la estética de `vy-product-card` del
 * kit de marca (foto, nombre a marcador, precio en verde, botón verde) pero
 * conectada al catálogo real: lleva al detalle, muestra el badge del admin,
 * el precio anterior, el stock y la segunda foto al pasar el mouse.
 *
 * <app-store-product-card [product]="p" (addToCart)="cart.add(p)" />
 */
@Component({
  selector: 'app-store-product-card',
  standalone: true,
  imports: [RouterLink, PesosPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="vy-card tarjeta">
      <a class="foto" [routerLink]="['/productos', product.id]" [attr.aria-label]="product.name">
        <img [src]="product.image" [alt]="product.name" loading="lazy" />
        @if (secondImage; as url) {
          <img class="foto-hover" [src]="url" alt="" loading="lazy" />
        }
        @if (!inStock) {
          <span class="vy-chip vy-chip--contorno etiqueta sin-stock">Sin stock</span>
        } @else if (product.badge) {
          <span class="vy-chip etiqueta">{{ product.badge.label }}</span>
        }
      </a>

      <div class="info">
        <a class="nombre vy-marker" [routerLink]="['/productos', product.id]">{{ product.name }}</a>
        <div class="precios">
          @if (product.originalPrice && product.originalPrice > product.price) {
            <span class="vy-precio-anterior">{{ product.originalPrice | pesos }}</span>
          }
          <span class="vy-precio">{{ product.price | pesos }}</span>
        </div>
      </div>

      <button type="button" class="vy-btn vy-btn--chico agregar" [disabled]="!inStock" (click)="addToCart.emit(product)">
        {{ inStock ? 'Agregar' : 'Sin stock' }}
      </button>
    </article>
  `,
  styles: [
    `
      :host { display: block; }
      .tarjeta { display: flex; flex-direction: column; height: 100%; }

      .foto {
        position: relative;
        display: block;
        aspect-ratio: 1;
        background: var(--vy-negro);
        overflow: hidden;
      }
      .foto img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: opacity 0.25s, transform 0.3s;
      }
      .foto-hover { opacity: 0; }
      .tarjeta:hover .foto img { transform: scale(1.04); }
      .tarjeta:hover .foto-hover { opacity: 1; }

      .etiqueta { position: absolute; top: var(--vy-space-3); left: var(--vy-space-3); }
      .sin-stock { background: var(--vy-negro); }

      .info {
        display: flex;
        flex-direction: column;
        gap: var(--vy-space-2);
        padding: var(--vy-space-4) var(--vy-space-4) var(--vy-space-3);
        flex: 1;
      }
      .nombre {
        font-size: var(--vy-fs-md);
        line-height: 1.2;
        text-decoration: none;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nombre:hover { color: var(--vy-verde); }
      .precios { display: flex; flex-direction: column; gap: var(--vy-space-1); margin-top: auto; }
      .vy-precio { font-size: var(--vy-fs-lg); }
      .agregar { margin: 0 var(--vy-space-4) var(--vy-space-4); }

      @media (min-width: 640px) {
        .nombre { font-size: var(--vy-fs-lg); }
        .vy-precio { font-size: var(--vy-fs-xl); }
      }
    `,
  ],
})
export class StoreProductCard {
  @Input({ required: true }) product!: Product;
  @Output() addToCart = new EventEmitter<Product>();

  get inStock(): boolean {
    return this.product.stock > 0;
  }

  get secondImage(): string | null {
    return this.product.images[1]?.url ?? null;
  }
}
