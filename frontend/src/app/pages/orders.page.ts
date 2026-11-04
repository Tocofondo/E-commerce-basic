import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DsSpinner } from '../design-system/index';
import { OrderService } from '../core/services/order.service';
import { ProductService } from '../core/services/product.service';
import { apiErrorMessage } from '../core/http-error';
import { OrderStatus } from '../core/models/order.model';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';
import { PesosPipe } from '../shared/store/pesos.pipe';

// Estados que van en chip verde lleno; el resto, con contorno.
const HIGHLIGHTED: OrderStatus[] = ['pagado', 'enviado', 'entregado'];

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [DatePipe, RouterLink, DsSpinner, VyLogoComponent, PesosPipe],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-4xl mx-auto flex flex-col gap-6">
        <h1 class="vy-titulo"><span class="vy-marker">Mis</span> <span class="vy-heavy">pedidos</span></h1>

        @if (orderSrv.loading()) {
          <div class="py-16 flex justify-center"><ds-spinner size="lg" /></div>
        } @else if (orderSrv.error()) {
          <div class="py-16 flex flex-col items-center gap-4 text-center">
            <p class="vy-muted">{{ orderSrv.error() }}</p>
            <button type="button" class="vy-btn" (click)="orderSrv.loadMine()">Reintentar</button>
          </div>
        } @else if (orders().length === 0) {
          <div class="text-center py-16 flex flex-col items-center gap-5">
            <vy-logo variante="sello" alto="64px" />
            <p class="vy-muted">Todavía no hiciste ningún pedido.</p>
            <a routerLink="/productos" class="vy-btn">Ver productos</a>
          </div>
        } @else {
          <div class="flex flex-col gap-3">
            @if (cancelError()) {
              <p class="text-sm text-error">{{ cancelError() }}</p>
            }
            @for (order of orders(); track order.id) {
              <div class="vy-card p-5 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-baseline gap-3">
                    <span class="vy-marker text-lg">Pedido #{{ order.id }}</span>
                    <span class="vy-label">{{ order.createdAt | date: 'short' }}</span>
                  </div>
                  <span class="vy-chip" [class.vy-chip--contorno]="!isHighlighted(order.status)">{{ order.status }}</span>
                </div>

                <ul class="text-sm vy-muted flex flex-col gap-1">
                  @for (item of order.items; track $index) {
                    <li>{{ item.qty }}x {{ item.product.name }}</li>
                  }
                </ul>

                @if (order.discountTotal > 0) {
                  <ul class="text-sm flex flex-col gap-1" style="color: var(--vy-verde)">
                    @for (d of order.discounts; track d.label) {
                      <li class="flex justify-between gap-3"><span>{{ d.label }}</span><span>−{{ d.amount | pesos }}</span></li>
                    }
                  </ul>
                }

                <div class="flex justify-between items-center gap-3 border-t border-border pt-3">
                  <span class="text-sm vy-muted">{{ order.shipping.address }}, {{ order.shipping.city }}</span>
                  <span class="flex items-baseline gap-2">
                    @if (order.discountTotal > 0) {
                      <span class="vy-precio-anterior">{{ order.subtotal | pesos }}</span>
                    }
                    <span class="vy-heavy text-lg whitespace-nowrap">{{ order.total | pesos }}</span>
                  </span>
                </div>

                <!-- Solo mientras está pendiente: ya pagado lo resuelve el admin. -->
                @if (order.status === 'pendiente') {
                  <div class="flex justify-end">
                    <button
                      type="button"
                      class="vy-btn vy-btn--secundario vy-btn--chico"
                      [disabled]="cancellingId() !== null"
                      (click)="cancel(order.id)"
                    >
                      @if (cancellingId() === order.id) { <span class="vy-btn-cargando"></span> }
                      Cancelar pedido
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </main>
  `,
})
export class OrdersPage {
  orderSrv = inject(OrderService);
  private products = inject(ProductService);

  cancellingId = signal<number | null>(null);
  cancelError = signal('');

  // El backend ya filtra por el usuario autenticado (GET /orders/me).
  orders = computed(() => this.orderSrv.orders());

  constructor() {
    this.orderSrv.loadMine();
  }

  async cancel(id: number): Promise<void> {
    if (!confirm(`¿Cancelar el pedido #${id}?`)) return;
    this.cancelError.set('');
    this.cancellingId.set(id);
    try {
      await this.orderSrv.cancelMine(id);
      // Se repuso stock: que el catálogo lo muestre.
      this.products.refresh();
    } catch (err) {
      // Ej. el admin lo marcó como pagado mientras tanto.
      this.cancelError.set(apiErrorMessage(err, 'No se pudo cancelar el pedido.'));
      this.orderSrv.loadMine();
    } finally {
      this.cancellingId.set(null);
    }
  }

  isHighlighted(status: OrderStatus): boolean {
    return HIGHLIGHTED.includes(status);
  }
}
