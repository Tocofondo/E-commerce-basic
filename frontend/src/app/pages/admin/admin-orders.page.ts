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
                <tr class="border-t border-border" [class.bg-neutral-50]="expandedId() === order.id">
                  <td class="px-4 py-3 text-neutral-800 font-medium">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"
                      [attr.aria-expanded]="expandedId() === order.id"
                      (click)="toggle(order.id)"
                    >
                      <span class="text-xs text-neutral-400">{{ expandedId() === order.id ? '▾' : '▸' }}</span>
                      #{{ order.id }}
                    </button>
                  </td>
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
                    @if (customerWhatsappLink(order); as link) {
                      <a [href]="link" target="_blank" rel="noopener" class="text-sm text-success hover:underline">
                        Contactar cliente
                      </a>
                    } @else {
                      <span class="text-xs text-neutral-400" title="El teléfono cargado no es un celular válido">Teléfono inválido</span>
                    }
                  </td>
                </tr>
                @if (expandedId() === order.id) {
                  <tr class="bg-neutral-50">
                    <td colspan="7" class="px-4 pb-5 pt-1">
                      <div class="grid md:grid-cols-[2fr_1fr] gap-6">
                        <div>
                          <p class="text-xs font-medium text-neutral-500 uppercase mb-2">Productos</p>
                          <ul class="flex flex-col gap-2">
                            @for (item of order.items; track $index) {
                              <li class="flex items-center gap-3">
                                <img [src]="item.product.image" [alt]="item.product.name" class="w-10 h-10 rounded-lg object-cover" />
                                <span class="flex-1 text-neutral-800">{{ item.qty }}x {{ item.product.name }}</span>
                                <span class="text-neutral-500">{{ item.product.price | number: '1.2-2' }} c/u</span>
                                <span class="text-neutral-800 font-medium w-24 text-right">{{ item.product.price * item.qty | number: '1.2-2' }}</span>
                              </li>
                            }
                          </ul>
                        </div>
                        <div class="flex flex-col gap-3">
                          <div>
                            <p class="text-xs font-medium text-neutral-500 uppercase mb-1">Envío</p>
                            <p class="text-neutral-800">{{ order.shipping.fullName }}</p>
                            <p class="text-neutral-600">{{ order.shipping.address }}</p>
                            <p class="text-neutral-600">{{ order.shipping.city }} (CP {{ order.shipping.postalCode }})</p>
                          </div>
                          <div>
                            <p class="text-xs font-medium text-neutral-500 uppercase mb-1">Contacto</p>
                            <p class="text-neutral-600">{{ order.shipping.phone }}</p>
                            @if (order.customerEmail) {
                              <a [href]="'mailto:' + order.customerEmail" class="text-brand-600 hover:underline break-all">{{ order.customerEmail }}</a>
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
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
  /** Pedido con el detalle (productos, dirección, email) desplegado. */
  expandedId = signal<number | null>(null);

  constructor() {
    this.orders.loadAll();
  }

  toggle(id: number): void {
    this.expandedId.update(current => (current === id ? null : id));
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

  customerWhatsappLink(order: Order): string | null {
    return this.whatsapp.buildCustomerLink(order);
  }
}
