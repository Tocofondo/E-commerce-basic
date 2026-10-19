import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DsSpinner } from '../design-system/index';
import { OrderService } from '../core/services/order.service';
import { OrderStatus } from '../core/models/order.model';
import { VyYapaComponent } from '../shared/brand/vy-yapa.component';
import { PesosPipe } from '../shared/store/pesos.pipe';

// Estados que van en chip verde lleno; el resto, con contorno.
const HIGHLIGHTED: OrderStatus[] = ['pagado', 'enviado', 'entregado'];

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [DatePipe, RouterLink, DsSpinner, VyYapaComponent, PesosPipe],
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
            <vy-yapa [tamano]="64" />
            <p class="vy-muted">Todavía no hiciste ningún pedido.</p>
            <a routerLink="/productos" class="vy-btn">Ver productos</a>
          </div>
        } @else {
          <div class="flex flex-col gap-3">
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

                <div class="flex justify-between items-center gap-3 border-t border-border pt-3">
                  <span class="text-sm vy-muted">{{ order.shipping.address }}, {{ order.shipping.city }}</span>
                  <span class="vy-heavy text-lg whitespace-nowrap">{{ order.total | pesos }}</span>
                </div>
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

  // El backend ya filtra por el usuario autenticado (GET /orders/me).
  orders = computed(() => this.orderSrv.orders());

  constructor() {
    this.orderSrv.loadMine();
  }

  isHighlighted(status: OrderStatus): boolean {
    return HIGHLIGHTED.includes(status);
  }
}
