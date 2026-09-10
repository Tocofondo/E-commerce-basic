import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { Order, OrderStatus } from '../../core/models/order.model';

const STATUSES: OrderStatus[] = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

@Component({
  selector: 'app-admin-orders-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  template: `
    <div class="flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Pedidos</h1>

      @if (orders.orders().length === 0) {
        <p class="text-neutral-500 text-sm">Todavía no hay pedidos.</p>
      } @else {
        <div class="bg-surface border border-border rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th class="px-4 py-3 font-medium">Pedido</th>
                <th class="px-4 py-3 font-medium">Fecha</th>
                <th class="px-4 py-3 font-medium">Cliente</th>
                <th class="px-4 py-3 font-medium">Teléfono</th>
                <th class="px-4 py-3 font-medium">Total</th>
                <th class="px-4 py-3 font-medium">Estado</th>
                <th class="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              @for (order of orders.orders(); track order.id) {
                <tr class="border-t border-border">
                  <td class="px-4 py-3 text-neutral-800 font-medium">#{{ order.id }}</td>
                  <td class="px-4 py-3 text-neutral-600">{{ order.createdAt | date: 'short' }}</td>
                  <td class="px-4 py-3 text-neutral-600">{{ order.shipping.fullName }}</td>
                  <td class="px-4 py-3 text-neutral-600">{{ order.shipping.phone }}</td>
                  <td class="px-4 py-3 text-neutral-600">{{ order.total | number: '1.2-2' }}</td>
                  <td class="px-4 py-3">
                    <select
                      [ngModel]="order.status"
                      (ngModelChange)="onStatusChange(order.id, $event)"
                      class="rounded-lg border border-border bg-surface text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      @for (status of statuses; track status) {
                        <option [value]="status">{{ status }}</option>
                      }
                    </select>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <a [href]="customerWhatsappLink(order)" target="_blank" rel="noopener" class="text-sm text-success hover:underline">
                      Contactar cliente
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminOrdersPage {
  orders = inject(OrderService);
  private whatsapp = inject(WhatsappService);
  statuses = STATUSES;

  onStatusChange(orderId: number, status: OrderStatus): void {
    this.orders.updateStatus(orderId, status);
  }

  customerWhatsappLink(order: Order): string {
    return this.whatsapp.buildCustomerLink(order);
  }
}
