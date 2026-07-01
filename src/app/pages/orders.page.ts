import { Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DsBadge, DsButton } from '../design-system/index';
import { OrderService } from '../core/services/order.service';
import { AuthService } from '../core/services/auth.service';
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
  imports: [DatePipe, DecimalPipe, RouterLink, DsBadge, DsButton],
  template: `
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Mis pedidos</h1>

      @if (orders().length === 0) {
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
                @for (item of order.items; track item.product.id) {
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
  private orderSrv = inject(OrderService);
  private auth = inject(AuthService);

  orders = computed(() => {
    const user = this.auth.currentUser();
    return user ? this.orderSrv.getByUser(user.id) : [];
  });

  statusVariant(status: OrderStatus): BadgeVariant {
    return STATUS_VARIANT[status];
  }
}
