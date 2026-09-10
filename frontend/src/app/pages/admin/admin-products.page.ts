import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DsButton } from '../../design-system/index';
import { ProductService } from '../../core/services/product.service';

@Component({
  selector: 'app-admin-products-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink, DsButton],
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-neutral-800">Productos</h1>
        <a routerLink="/admin/productos/nuevo">
          <ds-button variant="primary">Nuevo producto</ds-button>
        </a>
      </div>

      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-neutral-50 text-neutral-500 text-left">
            <tr>
              <th class="px-4 py-3 font-medium">Producto</th>
              <th class="px-4 py-3 font-medium">Categoría</th>
              <th class="px-4 py-3 font-medium">Precio</th>
              <th class="px-4 py-3 font-medium">Stock</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            @for (product of products.products(); track product.id) {
              <tr class="border-t border-border">
                <td class="px-4 py-3 flex items-center gap-3">
                  <img [src]="product.image" [alt]="product.name" class="w-10 h-10 rounded-lg object-cover" />
                  <span class="text-neutral-800 font-medium">{{ product.name }}</span>
                </td>
                <td class="px-4 py-3 text-neutral-600">{{ product.category }}</td>
                <td class="px-4 py-3 text-neutral-600">{{ product.price | number: '1.2-2' }}</td>
                <td class="px-4 py-3 text-neutral-600">{{ product.stock }}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <a [routerLink]="['/admin/productos', product.id]" class="text-brand-600 hover:underline mr-4">Editar</a>
                  <button (click)="onDelete(product.id)" class="text-error hover:underline">Eliminar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminProductsPage {
  products = inject(ProductService);

  onDelete(id: string | number): void {
    if (confirm('¿Eliminar este producto?')) {
      this.products.remove(Number(id));
    }
  }
}
