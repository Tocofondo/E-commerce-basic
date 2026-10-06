import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DsButton, DsCardProduct, DsSpinner } from '../design-system/index';
import { ProductService } from '../core/services/product.service';
import { CartService } from '../core/services/cart.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [DsButton, DsCardProduct, DsSpinner],
  template: `
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-12">

      <section class="bg-brand-600 rounded-2xl px-8 py-14 text-center flex flex-col items-center gap-4">
        <h1 class="text-3xl sm:text-4xl font-bold text-white">Todo lo que buscás, en un solo lugar</h1>
        <p class="text-brand-50 max-w-xl">Electrónica, deportes, hogar y más. Envíos a todo el país.</p>
        <ds-button variant="secondary" size="lg" (clicked)="router.navigate(['/productos'])">
          Ver productos
        </ds-button>
      </section>

      <section>
        <h2 class="text-2xl font-bold text-neutral-800 mb-6">Destacados</h2>
        @if (products.error() && !products.loaded()) {
          <div class="py-10 flex flex-col items-center gap-4 text-center">
            <p class="text-neutral-500 text-sm">{{ products.error() }}</p>
            <ds-button variant="primary" [loading]="products.loading()" (clicked)="products.refresh()">
              Reintentar
            </ds-button>
          </div>
        } @else if (!products.loaded()) {
          <div class="py-10 flex justify-center"><ds-spinner size="lg" /></div>
        } @else {
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            @for (product of featured(); track product.id) {
              <ds-card-product [product]="product" (addToCart)="onAddToCart($event)" />
            }
          </div>
        }
      </section>

    </main>
  `,
})
export class HomePage {
  products = inject(ProductService);
  private cart = inject(CartService);
  router = inject(Router);

  // Primero los que el admin marcó como "Destacado" (badge `featured`),
  // completando con el resto del catálogo hasta 4. Los sin stock, al final.
  featured = computed(() => {
    const list = this.products.products();
    const rank = (p: (typeof list)[number]) =>
      (p.badge?.variant === 'featured' ? 0 : 1) + (p.stock > 0 ? 0 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  });

  onAddToCart(id: string | number): void {
    const product = this.products.getById(Number(id));
    if (product) this.cart.add(product);
  }
}
