import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Dashboard</h1>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-surface border border-border rounded-xl p-5">
          <p class="text-sm text-neutral-500">Productos</p>
          <p class="text-2xl font-bold text-neutral-800 mt-1">{{ productCount() }}</p>
        </div>
        <div class="bg-surface border border-border rounded-xl p-5">
          <p class="text-sm text-neutral-500">Pedidos</p>
          <p class="text-2xl font-bold text-neutral-800 mt-1">{{ orderCount() }}</p>
        </div>
        <div class="bg-surface border border-border rounded-xl p-5">
          <p class="text-sm text-neutral-500">Ventas totales</p>
          <p class="text-2xl font-bold text-neutral-800 mt-1">{{ totalSales() | number: '1.2-2' }}</p>
        </div>
      </div>
    </div>
  `,
})
export class AdminDashboardPage {
  private products = inject(ProductService);
  private orders = inject(OrderService);

  productCount = computed(() => this.products.products().length);
  orderCount = computed(() => this.orders.orders().length);
  totalSales = computed(() => this.orders.orders().reduce((sum, o) => sum + o.total, 0));
}
