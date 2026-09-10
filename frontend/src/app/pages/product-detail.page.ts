import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DsBadge, DsButton, DsPrice } from '../design-system/index';
import { ProductService } from '../core/services/product.service';
import { CartService } from '../core/services/cart.service';

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [RouterLink, DsBadge, DsButton, DsPrice],
  template: `
    @if (product(); as product) {
      <main class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <a routerLink="/productos" class="text-sm text-brand-600 hover:underline">&larr; Volver a productos</a>

        <div class="grid sm:grid-cols-2 gap-8 mt-6">
          <div class="relative aspect-square bg-neutral-100 rounded-xl overflow-hidden">
            <img [src]="product.image" [alt]="product.name" class="w-full h-full object-cover" />
            @if (product.badge) {
              <div class="absolute top-4 left-4">
                <ds-badge [variant]="product.badge.variant">{{ product.badge.label }}</ds-badge>
              </div>
            }
          </div>

          <div class="flex flex-col gap-4">
            <p class="text-sm text-neutral-500">{{ product.category }}</p>
            <h1 class="text-2xl font-bold text-neutral-800">{{ product.name }}</h1>
            <ds-price [current]="product.price" [original]="product.originalPrice ?? null" size="lg" />
            <p class="text-neutral-600 leading-relaxed">{{ product.description }}</p>
            <p class="text-sm text-neutral-500">
              {{ product.stock > 0 ? product.stock + ' unidades disponibles' : 'Sin stock' }}
            </p>

            <div class="flex items-center gap-3 mt-2">
              <div class="flex items-center border border-border rounded-lg">
                <button (click)="decreaseQty()" class="px-3 py-2 text-neutral-600 hover:bg-neutral-100" aria-label="Restar">-</button>
                <span class="px-4 text-sm font-medium">{{ qty() }}</span>
                <button (click)="increaseQty()" class="px-3 py-2 text-neutral-600 hover:bg-neutral-100" aria-label="Sumar">+</button>
              </div>
              <ds-button
                variant="primary"
                [disabled]="product.stock === 0"
                (clicked)="onAddToCart(product)"
              >
                {{ product.stock === 0 ? 'Sin stock' : 'Agregar al carrito' }}
              </ds-button>
            </div>

            @if (added()) {
              <p class="text-sm text-success">Producto agregado al carrito.</p>
            }
          </div>
        </div>
      </main>
    } @else {
      <main class="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center text-neutral-500">
        Producto no encontrado.
      </main>
    }
  `,
})
export class ProductDetailPage {
  private route = inject(ActivatedRoute);
  private productsSrv = inject(ProductService);
  private cart = inject(CartService);
  router = inject(Router);

  private id = toSignal(
    this.route.paramMap.pipe(map(params => Number(params.get('id')))),
    { initialValue: Number(this.route.snapshot.paramMap.get('id')) }
  );

  product = computed(() => this.productsSrv.getById(this.id()));

  qty = signal(1);
  added = signal(false);

  increaseQty(): void {
    this.qty.update(q => q + 1);
  }

  decreaseQty(): void {
    this.qty.update(q => Math.max(1, q - 1));
  }

  onAddToCart(product: NonNullable<ReturnType<typeof this.product>>): void {
    this.cart.add(product, this.qty());
    this.added.set(true);
    this.qty.set(1);
  }
}
