import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DsSpinner } from '../design-system/index';
import { ProductService } from '../core/services/product.service';
import { CartService } from '../core/services/cart.service';
import { Product } from '../core/models/product.model';
import { StoreProductCard } from '../shared/store/store-product-card';

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [FormsModule, DsSpinner, StoreProductCard],
  template: `
    <main class="vy-container py-10 flex flex-col gap-6">
      <h1 class="vy-titulo"><span class="vy-marker">Todos los</span> <span class="vy-heavy">productos</span></h1>

      <div class="flex flex-col gap-4">
        <label class="w-full sm:max-w-sm">
          <span class="sr-only">Buscar</span>
          <input
            class="vy-input"
            type="search"
            placeholder="Buscá: auriculares, botella..."
            [(ngModel)]="search"
            (ngModelChange)="searchSignal.set($event)"
          />
        </label>

        @if (categories().length > 1) {
          <div class="flex flex-wrap gap-2" role="group" aria-label="Categorías">
            <button
              type="button"
              class="vy-chip cursor-pointer"
              [class.vy-chip--contorno]="selectedCategory() !== ''"
              [attr.aria-pressed]="selectedCategory() === ''"
              (click)="selectedCategory.set('')"
            >Todo</button>
            @for (cat of categories(); track cat) {
              <button
                type="button"
                class="vy-chip cursor-pointer"
                [class.vy-chip--contorno]="cat !== selectedCategory()"
                [attr.aria-pressed]="cat === selectedCategory()"
                (click)="selectedCategory.set(cat === selectedCategory() ? '' : cat)"
              >{{ cat }}</button>
            }
          </div>
        }
      </div>

      @if (productsSrv.error() && !productsSrv.loaded()) {
        <div class="py-10 flex flex-col items-center gap-4 text-center">
          <p class="vy-muted">{{ productsSrv.error() }}</p>
          <button type="button" class="vy-btn" [disabled]="productsSrv.loading()" (click)="productsSrv.refresh()">
            @if (productsSrv.loading()) { <span class="vy-btn-cargando"></span> }
            Reintentar
          </button>
        </div>
      } @else if (!productsSrv.loaded()) {
        <div class="py-16 flex justify-center"><ds-spinner size="lg" /></div>
      } @else if (filtered().length === 0) {
        <p class="vy-muted py-10 text-center">No encontramos productos con esa búsqueda.</p>
      } @else {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          @for (product of filtered(); track product.id) {
            <app-store-product-card [product]="product" (addToCart)="onAddToCart($event)" />
          }
        </div>
      }
    </main>
  `,
})
export class CatalogPage {
  productsSrv = inject(ProductService);
  private cart = inject(CartService);

  search = '';
  searchSignal = signal('');
  selectedCategory = signal('');

  categories = computed(() => {
    const set = new Set(this.productsSrv.products().map(p => p.category));
    return Array.from(set);
  });

  filtered = computed(() => {
    const term = this.searchSignal().trim().toLowerCase();
    const category = this.selectedCategory();
    return this.productsSrv.products().filter(p => {
      const matchesTerm = !term || p.name.toLowerCase().includes(term);
      const matchesCategory = !category || p.category === category;
      return matchesTerm && matchesCategory;
    });
  });

  onAddToCart(product: Product): void {
    this.cart.add(product);
  }
}
