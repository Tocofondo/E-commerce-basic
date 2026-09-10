import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsButton, DsInput, DsPrice } from '../design-system/index';
import { CartService } from '../core/services/cart.service';
import { OrderService } from '../core/services/order.service';
import { AuthService } from '../core/services/auth.service';
import { WhatsappService } from '../core/services/whatsapp.service';
import { Order, ShippingInfo } from '../core/models/order.model';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, DsButton, DsInput, DsPrice],
  template: `
    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Checkout</h1>

      @if (placedOrder(); as order) {
        <div class="bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
          <p class="text-success font-medium">¡Pedido #{{ order.id }} confirmado!</p>
          <p class="text-neutral-600 text-sm">
            Enviá el pedido por WhatsApp para que el admin lo reciba al instante.
          </p>
          <a [href]="whatsappLink(order)" target="_blank" rel="noopener">
            <ds-button variant="primary">Enviar pedido por WhatsApp</ds-button>
          </a>
          <a routerLink="/mis-pedidos" class="text-sm text-brand-600 hover:underline">Ver mis pedidos</a>
        </div>
      } @else if (cart.items().length === 0) {
        <div class="text-center py-16 flex flex-col items-center gap-4">
          <p class="text-neutral-500">Tu carrito está vacío.</p>
          <a routerLink="/productos">
            <ds-button variant="primary">Ver productos</ds-button>
          </a>
        </div>
      } @else {
        <div class="grid sm:grid-cols-2 gap-8">
          <form class="flex flex-col gap-4" (ngSubmit)="onSubmit()">
            <h2 class="text-lg font-semibold text-neutral-800">Datos de envío</h2>
            <ds-input label="Nombre completo" [required]="true" [(ngModel)]="shipping.fullName" name="fullName" />
            <ds-input label="Teléfono" [required]="true" [(ngModel)]="shipping.phone" name="phone" />
            <ds-input label="Dirección" [required]="true" [(ngModel)]="shipping.address" name="address" />
            <ds-input label="Ciudad" [required]="true" [(ngModel)]="shipping.city" name="city" />
            <ds-input label="Código postal" [required]="true" [(ngModel)]="shipping.postalCode" name="postalCode" />

            <ds-button variant="primary" type="submit" [fullWidth]="true">Confirmar pedido</ds-button>
          </form>

          <div class="flex flex-col gap-3">
            <h2 class="text-lg font-semibold text-neutral-800">Resumen</h2>
            @for (item of cart.items(); track item.product.id) {
              <div class="flex justify-between text-sm text-neutral-600">
                <span>{{ item.qty }}x {{ item.product.name }}</span>
                <span>{{ item.product.price * item.qty | number: '1.2-2' }}</span>
              </div>
            }
            <div class="flex justify-between items-center border-t border-border pt-3 mt-2">
              <span class="font-medium text-neutral-800">Total</span>
              <ds-price [current]="cart.total()" size="lg" />
            </div>
          </div>
        </div>
      }
    </main>
  `,
})
export class CheckoutPage {
  cart = inject(CartService);
  private orders = inject(OrderService);
  private auth = inject(AuthService);
  private whatsapp = inject(WhatsappService);

  shipping: ShippingInfo = { fullName: '', phone: '', address: '', city: '', postalCode: '' };
  placedOrder = signal<Order | null>(null);

  onSubmit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    const order = this.orders.place(user.id, this.cart.items(), this.shipping);
    this.cart.clear();
    this.placedOrder.set(order);
  }

  whatsappLink(order: Order): string {
    return this.whatsapp.buildOrderLink(order);
  }
}
