import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DsSpinner } from '../design-system/index';
import { ProductService } from '../core/services/product.service';
import { CartService } from '../core/services/cart.service';
import { VyYapaComponent } from '../shared/brand/vy-yapa.component';
import { PesosPipe } from '../shared/store/pesos.pipe';

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [RouterLink, DsSpinner, VyYapaComponent, PesosPipe],
  template: `
    @if (product(); as product) {
      <main class="vy-container py-10">
        <a routerLink="/productos" class="text-sm font-bold no-underline">&larr; Volver a productos</a>

        <div class="grid md:grid-cols-2 gap-8 lg:gap-12 mt-6">
          <div class="flex flex-col gap-3">
            <div class="vy-card relative aspect-square">
              <img [src]="mainImage()" [alt]="product.name" class="w-full h-full object-cover" />
              @if (product.badge && product.stock > 0) {
                <span class="vy-chip absolute top-4 left-4">{{ product.badge.label }}</span>
              }
            </div>

            @if (product.images.length > 1) {
              <div class="flex gap-2 flex-wrap">
                @for (img of product.images; track img.id; let i = $index) {
                  <button
                    type="button"
                    (click)="selectedIndex.set(i)"
                    class="w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors cursor-pointer"
                    [class.border-brand-500]="i === selectedIndex()"
                    [class.border-border]="i !== selectedIndex()"
                    [attr.aria-label]="'Ver imagen ' + (i + 1)"
                  >
                    <img [src]="img.url" [alt]="product.name" class="w-full h-full object-cover" />
                  </button>
                }
              </div>
            }
          </div>

          <div class="flex flex-col gap-4">
            <span class="vy-label">{{ product.category }}</span>
            <h1 class="vy-marker text-3xl sm:text-4xl leading-tight">{{ product.name }}</h1>
            <div class="flex items-baseline flex-wrap gap-3">
              <span class="vy-precio" style="font-size: var(--vy-fs-2xl)">{{ product.price | pesos }}</span>
              @if (product.originalPrice && product.originalPrice > product.price) {
                <span class="vy-precio-anterior" style="font-size: var(--vy-fs-md)">{{ product.originalPrice | pesos }}</span>
              }
            </div>
            <p class="vy-muted leading-relaxed whitespace-pre-line">{{ product.description }}</p>
            <p class="text-sm" [class.vy-muted]="product.stock > 0" [class.text-error]="product.stock === 0">
              {{ product.stock > 0 ? product.stock + ' unidades disponibles' : 'Sin stock por ahora' }}
            </p>

            <div class="flex items-center flex-wrap gap-3 mt-2">
              <div class="vy-cantidad">
                <button type="button" (click)="decreaseQty()" [disabled]="qty() <= 1" aria-label="Restar">-</button>
                <span>{{ qty() }}</span>
                <button type="button" (click)="increaseQty()" [disabled]="qty() >= available()" aria-label="Sumar">+</button>
              </div>
              <button type="button" class="vy-btn" [disabled]="available() === 0" (click)="onAddToCart(product)">
                {{ product.stock === 0 ? 'Sin stock' : available() === 0 ? 'Ya está todo en tu carrito' : 'Agregar al carrito' }}
              </button>
            </div>

            @if (message(); as msg) {
              <p class="text-sm" [class.text-success]="msg.ok" [class.text-error]="!msg.ok">
                {{ msg.text }}
                @if (msg.ok) { <a routerLink="/carrito" class="font-bold ml-1">Ver carrito</a> }
              </p>
            }

            <div class="vy-card flex items-center gap-4 p-4 mt-4">
              <vy-yapa [tamano]="40" [rayitas]="false" />
              <p class="text-sm vy-muted">
                <span class="vy-marker text-base">Va con yapa:</span>
                en cada pedido te mandamos un regalo.
              </p>
            </div>
          </div>
        </div>
      </main>
    } @else if (!productsSrv.loaded() && !productsSrv.error()) {
      <main class="vy-container py-16 flex justify-center">
        <ds-spinner size="lg" />
      </main>
    } @else if (productsSrv.error(); as error) {
      <main class="vy-container py-16 flex flex-col items-center gap-4 text-center">
        <p class="vy-muted">{{ error }}</p>
        <button type="button" class="vy-btn" [disabled]="productsSrv.loading()" (click)="productsSrv.refresh()">
          @if (productsSrv.loading()) { <span class="vy-btn-cargando"></span> }
          Reintentar
        </button>
      </main>
    } @else {
      <main class="vy-container py-16 flex flex-col items-center gap-4 text-center">
        <h1 class="vy-titulo"><span class="vy-marker">No lo</span> <span class="vy-heavy">encontramos</span></h1>
        <p class="vy-muted">Puede que ya no esté en el catálogo.</p>
        <a routerLink="/productos" class="vy-btn">Ver todos los productos</a>
      </main>
    }
  `,
})
export class ProductDetailPage {
  private route = inject(ActivatedRoute);
  productsSrv = inject(ProductService);
  private cart = inject(CartService);

  private id = toSignal(
    this.route.paramMap.pipe(map(params => Number(params.get('id')))),
    { initialValue: Number(this.route.snapshot.paramMap.get('id')) }
  );

  product = computed(() => this.productsSrv.getById(this.id()));

  // Índice de la galería seleccionado; `product.image` (la primera imagen)
  // es el fallback cuando el producto no tiene ninguna imagen cargada.
  selectedIndex = signal(0);
  mainImage = computed(() => {
    const product = this.product();
    return product?.images[this.selectedIndex()]?.url ?? product?.image ?? '';
  });

  qty = signal(1);
  message = signal<{ ok: boolean; text: string } | null>(null);

  /** Unidades que todavía se pueden agregar (stock menos lo que ya está en
   * el carrito): tope del selector de cantidad. */
  available = computed(() => {
    const product = this.product();
    return product ? Math.max(0, product.stock - this.cart.qtyOf(product.id)) : 0;
  });

  constructor() {
    // Al navegar a otro producto, volver a arrancar en la primera imagen.
    effect(() => {
      this.id();
      this.selectedIndex.set(0);
      this.qty.set(1);
      this.message.set(null);
    });
  }

  increaseQty(): void {
    this.qty.update(q => Math.min(q + 1, Math.max(1, this.available())));
  }

  decreaseQty(): void {
    this.qty.update(q => Math.max(1, q - 1));
  }

  onAddToCart(product: NonNullable<ReturnType<typeof this.product>>): void {
    const requested = this.qty();
    const added = this.cart.add(product, requested);
    if (added === 0) {
      this.message.set({ ok: false, text: 'No quedan más unidades disponibles de este producto.' });
    } else if (added < requested) {
      this.message.set({ ok: true, text: `Se agregaron ${added} (no hay más stock disponible).` });
    } else {
      this.message.set({ ok: true, text: 'Listo, lo sumamos al carrito.' });
    }
    this.qty.set(1);
  }
}
