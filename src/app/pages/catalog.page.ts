import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DsCardProduct, DsInput } from '../design-system/index';
import { ProductService } from '../core/services/product.service';
import { CartService } from '../core/services/cart.service';

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsCardProduct, DsInput],
  template: `
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Productos</h1>

      <div class="flex flex-col sm:flex-row gap-4 sm:items-end">
        <div class="w-full sm:max-w-sm">
          <ds-input
            label="Buscar"
            type="search"
            placeholder="Auriculares, zapatillas..."
            prefixIcon="🔍"
            [(ngModel)]="search"
            (ngModelChange)="searchSignal.set($event)"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          @for (cat of categories(); track cat) {
            <button
              (click)="selectedCategory.set(cat === selectedCategory() ? '' : cat)"
              [class]="cat === selectedCategory()
                ? 'px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white'
                : 'px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200'"
            >
              {{ cat }}
            </button>
          }
        </div>
      </div>

      @if (filtered().length === 0) {
        <p class="text-neutral-500 text-sm py-10 text-center">No se encontraron productos.</p>
      } @else {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (product of filtered(); track product.id) {
            <div class="flex flex-col gap-2">
              <ds-card-product [product]="product" (addToCart)="onAddToCart($event)" />
              <a [routerLink]="['/productos', product.id]" class="text-xs text-brand-600 hover:underline text-center">
                Ver detalle
              </a>
            </div>
          }
        </div>
      }
    </main>
  `,
})
export class CatalogPage {
  private productsSrv = inject(ProductService);
  private cart = inject(CartService);
  router = inject(Router);

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

  onAddToCart(id: string | number): void {
    const product = this.productsSrv.getById(Number(id));
    if (product) this.cart.add(product);
  }
}
