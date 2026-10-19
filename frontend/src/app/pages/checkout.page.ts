import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { CartService } from '../core/services/cart.service';
import { OrderService } from '../core/services/order.service';
import { AuthService } from '../core/services/auth.service';
import { WhatsappService } from '../core/services/whatsapp.service';
import { ProductService } from '../core/services/product.service';
import { apiErrorMessage } from '../core/http-error';
import { Order, ShippingInfo } from '../core/models/order.model';
import { VyYapaComponent } from '../shared/brand/vy-yapa.component';
import { PesosPipe } from '../shared/store/pesos.pipe';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput, VyYapaComponent, PesosPipe],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-4xl mx-auto flex flex-col gap-6">
        @if (placedOrder(); as order) {
          <div class="vy-card p-6 sm:p-10 flex flex-col items-center gap-5 text-center">
            <vy-yapa [tamano]="72" />
            <h1 class="vy-titulo">
              <span class="vy-marker">Pedido #{{ order.id }}</span>
              <span class="vy-heavy">confirmado</span>
            </h1>
            <p class="vy-muted max-w-md">
              Mandanos el pedido por WhatsApp así nos llega al toque y coordinamos la entrega.
            </p>
            <a [href]="whatsappLink(order)" target="_blank" rel="noopener" class="vy-btn vy-btn--marcador">
              Enviar pedido por WhatsApp
            </a>
            <a routerLink="/mis-pedidos" class="text-sm font-bold">Ver mis pedidos</a>
          </div>
        } @else if (cart.items().length === 0) {
          <h1 class="vy-titulo"><span class="vy-marker">Finalizar</span> <span class="vy-heavy">pedido</span></h1>
          <div class="text-center py-16 flex flex-col items-center gap-5">
            <vy-yapa [tamano]="64" />
            <p class="vy-muted">Tu carrito está vacío.</p>
            <a routerLink="/productos" class="vy-btn">Ver productos</a>
          </div>
        } @else {
          <h1 class="vy-titulo"><span class="vy-marker">Finalizar</span> <span class="vy-heavy">pedido</span></h1>
          <div class="grid md:grid-cols-[3fr_2fr] gap-6 items-start">
            <form class="vy-card p-5 sm:p-6 flex flex-col gap-4" (ngSubmit)="onSubmit()">
              <h2 class="vy-marker text-xl">Datos de envío</h2>
              <ds-input label="Nombre completo" [required]="true" [(ngModel)]="shipping.fullName" name="fullName" />
              <ds-input label="Teléfono" type="tel" [required]="true" [(ngModel)]="shipping.phone" name="phone" />
              <ds-input label="Dirección" [required]="true" [(ngModel)]="shipping.address" name="address" />
              <div class="grid grid-cols-2 gap-4">
                <ds-input label="Ciudad" [required]="true" [(ngModel)]="shipping.city" name="city" />
                <ds-input label="Código postal" [required]="true" [(ngModel)]="shipping.postalCode" name="postalCode" />
              </div>

              @if (error()) {
                <p class="text-sm text-error">{{ error() }}</p>
              }

              @if (cart.overStock().length) {
                <p class="text-sm text-error">
                  Algunos productos ya no tienen stock suficiente.
                  <a routerLink="/carrito" class="underline">Ajustá el carrito</a> para continuar.
                </p>
              }

              <button
                type="submit"
                class="vy-btn vy-btn--bloque"
                [disabled]="loading() || cart.overStock().length > 0"
              >
                @if (loading()) { <span class="vy-btn-cargando"></span> }
                Confirmar pedido
              </button>
            </form>

            <aside class="vy-card p-5 sm:p-6 flex flex-col gap-3">
              <h2 class="vy-marker text-xl">Resumen</h2>
              @for (item of cart.items(); track item.product.id) {
                <div class="flex justify-between gap-3 text-sm">
                  <span class="vy-muted">{{ item.qty }}x {{ item.product.name }}</span>
                  <span class="font-bold whitespace-nowrap">{{ item.product.price * item.qty | pesos }}</span>
                </div>
              }
              <div class="flex items-center gap-3 text-sm">
                <vy-yapa [tamano]="28" [rayitas]="false" />
                <span class="vy-muted">1x Yapa (regalo)</span>
              </div>
              <div class="flex justify-between items-center border-t border-border pt-4 mt-2">
                <span class="vy-label">Total</span>
                <span class="vy-precio">{{ cart.total() | pesos }}</span>
              </div>
            </aside>
          </div>
        }
      </div>
    </main>
  `,
})
export class CheckoutPage {
  cart = inject(CartService);
  private orders = inject(OrderService);
  private auth = inject(AuthService);
  private products = inject(ProductService);
  private whatsapp = inject(WhatsappService);

  // Nombre y teléfono precargados desde la cuenta (se pueden cambiar si el
  // envío es para otra persona). `name` cae en el email si no cargó nombre.
  private user = this.auth.currentUser();
  shipping: ShippingInfo = {
    fullName: this.user && this.user.name !== this.user.email ? this.user.name : '',
    phone: this.user?.phone ?? '',
    address: '',
    city: '',
    postalCode: '',
  };
  placedOrder = signal<Order | null>(null);
  error = signal('');
  loading = signal(false);

  async onSubmit(): Promise<void> {
    if (!this.auth.currentUser()) return;

    this.error.set('');
    this.loading.set(true);
    try {
      const order = await this.orders.place(this.cart.items(), this.shipping);
      this.cart.clear();
      this.placedOrder.set(order);
      // El backend descontó stock: refrescar para que el catálogo lo muestre.
      this.products.refresh();
    } catch (err) {
      // Ej. 400 "No hay stock suficiente de ..." (alguien compró antes):
      // refrescar el catálogo para que el carrito marque qué ajustar.
      this.error.set(apiErrorMessage(err, 'No se pudo confirmar el pedido. Probá de nuevo.'));
      this.products.refresh();
    } finally {
      this.loading.set(false);
    }
  }

  whatsappLink(order: Order): string {
    return this.whatsapp.buildOrderLink(order);
  }
}
