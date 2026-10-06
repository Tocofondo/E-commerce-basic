import { Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DsBadge, DsButton, DsSpinner } from '../design-system/index';
import { OrderService } from '../core/services/order.service';
import { OrderStatus } from '../core/models/order.model';
import { BadgeVariant } from '../design-system/badge/ds-badge';

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pendiente: 'neutral',
  pagado: 'new',
  enviado: 'featured',
  entregado: 'new',
  cancelado: 'out-of-stock',
};

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, DsBadge, DsButton, DsSpinner],
  template: `
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Mis pedidos</h1>

      @if (orderSrv.loading()) {
        <div class="py-16 flex justify-center"><ds-spinner size="lg" /></div>
      } @else if (orderSrv.error()) {
        <div class="py-16 flex flex-col items-center gap-4 text-center">
          <p class="text-neutral-500">{{ orderSrv.error() }}</p>
          <ds-button variant="primary" (clicked)="orderSrv.loadMine()">Reintentar</ds-button>
        </div>
      } @else if (orders().length === 0) {
        <div class="text-center py-16 flex flex-col items-center gap-4">
          <p class="text-neutral-500">Todavía no realizaste ningún pedido.</p>
          <a routerLink="/productos">
            <ds-button variant="primary">Ver productos</ds-button>
          </a>
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          @for (order of orders(); track order.id) {
            <div class="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-neutral-800">Pedido #{{ order.id }}</span>
                  <span class="text-xs text-neutral-500 ml-2">{{ order.createdAt | date: 'short' }}</span>
                </div>
                <ds-badge [variant]="statusVariant(order.status)">{{ order.status }}</ds-badge>
              </div>

              <ul class="text-sm text-neutral-600 flex flex-col gap-1">
                @for (item of order.items; track $index) {
                  <li>{{ item.qty }}x {{ item.product.name }}</li>
                }
              </ul>

              <div class="flex justify-between items-center border-t border-border pt-3">
                <span class="text-sm text-neutral-500">{{ order.shipping.address }}, {{ order.shipping.city }}</span>
                <span class="font-medium text-neutral-800">{{ order.total | number: '1.2-2' }}</span>
              </div>
            </div>
          }
        </div>
      }
    </main>
  `,
})
export class OrdersPage {
  orderSrv = inject(OrderService);

  // El backend ya filtra por el usuario autenticado (GET /orders/me).
  orders = computed(() => this.orderSrv.orders());

  constructor() {
    this.orderSrv.loadMine();
  }

  statusVariant(status: OrderStatus): BadgeVariant {
    return STATUS_VARIANT[status];
  }
}
