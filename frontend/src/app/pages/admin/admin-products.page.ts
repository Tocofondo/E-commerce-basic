import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DsBadge, DsButton } from '../../design-system/index';
import { ProductService } from '../../core/services/product.service';
import { apiErrorMessage } from '../../core/http-error';

@Component({
  selector: 'app-admin-products-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink, DsBadge, DsButton],
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
            @for (product of products.allProducts(); track product.id) {
              <tr class="border-t border-border" [class.opacity-60]="!product.isActive">
                <td class="px-4 py-3 flex items-center gap-3">
                  <img [src]="product.image" [alt]="product.name" class="w-10 h-10 rounded-lg object-cover" />
                  <span class="text-neutral-800 font-medium">{{ product.name }}</span>
                  @if (!product.isActive) {
                    <ds-badge variant="neutral">Pausado</ds-badge>
                  }
                </td>
                <td class="px-4 py-3 text-neutral-600">{{ product.category }}</td>
                <td class="px-4 py-3 text-neutral-600">{{ product.price | number: '1.2-2' }}</td>
                <td class="px-4 py-3 text-neutral-600">{{ product.stock }}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <a [routerLink]="['/admin/productos', product.id]" class="text-brand-600 hover:underline mr-4">Editar</a>
                  @if (product.isActive) {
                    <button (click)="onPause(product.id)" class="text-error hover:underline">Pausar</button>
                  } @else {
                    <button (click)="onReactivate(product.id)" class="text-brand-600 hover:underline">Reactivar</button>
                  }
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

  // "Pausar" es el soft delete del backend: el producto sale de la tienda
  // pero se conserva (y su imagen sigue viéndose en los pedidos viejos).
  async onPause(id: string | number): Promise<void> {
    if (!confirm('¿Pausar este producto? Deja de verse en la tienda; lo podés reactivar cuando quieras.')) return;
    try {
      await this.products.pause(Number(id));
    } catch (err) {
      alert(apiErrorMessage(err, 'No se pudo pausar el producto.'));
    }
  }

  async onReactivate(id: string | number): Promise<void> {
    try {
      await this.products.reactivate(Number(id));
    } catch (err) {
      alert(apiErrorMessage(err, 'No se pudo reactivar el producto.'));
    }
  }
}
