import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DsButton, DsSpinner } from '../../design-system/index';
import { ALLOWED_TRANSITIONS, OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';
import { apiErrorMessage } from '../../core/http-error';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { Order, OrderStatus } from '../../core/models/order.model';

@Component({
  selector: 'app-admin-orders-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, DsButton, DsSpinner],
  template: `
    <div class="flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Pedidos</h1>

      @if (statusError()) {
        <p class="text-sm text-error">{{ statusError() }}</p>
      }

      @if (orders.loading()) {
        <div class="py-10 flex justify-center"><ds-spinner size="lg" /></div>
      } @else if (orders.error()) {
        <div class="py-10 flex flex-col items-center gap-4 text-center">
          <p class="text-neutral-500 text-sm">{{ orders.error() }}</p>
          <ds-button variant="primary" (clicked)="orders.loadAll()">Reintentar</ds-button>
        </div>
      } @else if (orders.orders().length === 0) {
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
                    <!-- Solo el estado actual y los siguientes válidos (mismo mapa
                         que el backend). Select nativo, sin ngModel, para
                         poder volverlo atrás si el cambio falla o se cancela. -->
                    <select
                      (change)="onStatusChange(order, $any($event.target))"
                      [disabled]="nextStatuses(order).length === 0 || updatingId() === order.id"
                      class="rounded-lg border border-border bg-surface text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                    >
                      @for (status of [order.status].concat(nextStatuses(order)); track status) {
                        <option [value]="status" [selected]="status === order.status">{{ status }}</option>
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
  private products = inject(ProductService);
  private whatsapp = inject(WhatsappService);

  statusError = signal('');
  updatingId = signal<number | null>(null);

  constructor() {
    this.orders.loadAll();
  }

  nextStatuses(order: Order): OrderStatus[] {
    return ALLOWED_TRANSITIONS[order.status];
  }

  async onStatusChange(order: Order, select: HTMLSelectElement): Promise<void> {
    const status = select.value as OrderStatus;
    this.statusError.set('');

    if (
      status === 'cancelado' &&
      !confirm(`¿Cancelar el pedido #${order.id}? Se devuelve el stock y no se puede deshacer.`)
    ) {
      select.value = order.status;
      return;
    }

    this.updatingId.set(order.id);
    try {
      await this.orders.updateStatus(order.id, status);
      // Cancelar repone stock en el backend: refrescar el catálogo.
      if (status === 'cancelado') this.products.refresh();
    } catch (err) {
      select.value = order.status;
      this.statusError.set(
        apiErrorMessage(err, `No se pudo cambiar el estado del pedido #${order.id}.`),
      );
    } finally {
      this.updatingId.set(null);
    }
  }

  customerWhatsappLink(order: Order): string {
    return this.whatsapp.buildCustomerLink(order);
  }
}
