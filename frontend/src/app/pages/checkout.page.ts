import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { CartService } from '../core/services/cart.service';
import { OrderService } from '../core/services/order.service';
import { AuthService } from '../core/services/auth.service';
import { WhatsappService } from '../core/services/whatsapp.service';
import { ProductService } from '../core/services/product.service';
import { PromotionService, cartQuote } from '../core/services/promotion.service';
import { MyCoupon } from '../core/models/promotion.model';
import { apiErrorMessage } from '../core/http-error';
import { INVALID_PHONE_MESSAGE, normalizeArPhone } from '../core/phone';
import { Order, ShippingInfo } from '../core/models/order.model';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';
import { PesosPipe } from '../shared/store/pesos.pipe';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput, VyLogoComponent, PesosPipe],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-4xl mx-auto flex flex-col gap-6">
        @if (placedOrder(); as order) {
          <div class="vy-card p-6 sm:p-10 flex flex-col items-center gap-5 text-center">
            <vy-logo variante="sello" alto="72px" />
            <h1 class="vy-titulo">
              <span class="vy-marker">Pedido #{{ order.id }}</span>
              <span class="vy-heavy">confirmado</span>
            </h1>
            @if (whatsappEnabled) {
              <p class="vy-muted max-w-md">
                Te llevamos a WhatsApp para que nos mandes el pedido y coordinemos el pago y la entrega.
              </p>
              <a [href]="whatsappLink(order)" class="vy-btn vy-btn--marcador">
                Enviar pedido por WhatsApp
              </a>
            } @else {
              <p class="vy-muted max-w-md">Te vamos a escribir para coordinar el pago y la entrega.</p>
            }
            @if (order.userId) {
              <a routerLink="/mis-pedidos" class="text-sm font-bold">Ver mis pedidos</a>
            } @else {
              <!-- Sin cuenta no hay "mis pedidos": cancelar o cambiar algo es por WhatsApp. -->
              <p class="text-sm vy-muted max-w-md">
                Guardá el número de pedido (#{{ order.id }}). Si querés cancelarlo o cambiar algo,
                @if (whatsappEnabled) {
                  <a [href]="cancelLink(order)" class="font-bold underline">avisanos por WhatsApp</a>.
                } @else {
                  avisanos por WhatsApp.
                }
              </p>
            }
          </div>
        } @else if (cart.items().length === 0) {
          <h1 class="vy-titulo"><span class="vy-marker">Finalizar</span> <span class="vy-heavy">pedido</span></h1>
          <div class="text-center py-16 flex flex-col items-center gap-5">
            <vy-logo variante="sello" alto="64px" />
            <p class="vy-muted">Tu carrito está vacío.</p>
            <a routerLink="/productos" class="vy-btn">Ver productos</a>
          </div>
        } @else {
          <h1 class="vy-titulo"><span class="vy-marker">Finalizar</span> <span class="vy-heavy">pedido</span></h1>
          <div class="grid md:grid-cols-[3fr_2fr] gap-6 items-start">
            <form class="vy-card p-5 sm:p-6 flex flex-col gap-4" (ngSubmit)="onSubmit()">
              @if (!isLoggedIn) {
                <p class="text-sm vy-muted">
                  Estás comprando sin cuenta.
                  <a routerLink="/login" [queryParams]="{ redirect: '/checkout' }" class="font-bold underline">Ingresá</a>
                  si querés seguir tus pedidos desde la web.
                </p>
              }
              <h2 class="vy-marker text-xl">Contacto</h2>
              @if (isLoggedIn) {
                <p class="text-sm vy-muted">Te escribimos a {{ user?.email }} o al celular que dejes.</p>
              } @else {
                <p class="text-sm vy-muted">Dejanos al menos un email o un celular.</p>
                <ds-input label="Email" type="email" placeholder="vos@ejemplo.com" [(ngModel)]="email" name="email" />
              }
              <ds-input label="Celular" type="tel" placeholder="341 555-1234" hint="Con código de área, sin 0 ni 15" [(ngModel)]="shipping.phone" name="phone" />

              <h2 class="vy-marker text-xl">Datos de envío</h2>
              <ds-input label="Nombre completo" [required]="true" [(ngModel)]="shipping.fullName" name="fullName" />
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
                <vy-logo class="shrink-0" variante="sello-simple" alto="36px" />
                <span class="vy-muted">1x Yapa (regalo)</span>
              </div>

              <!-- Cupón: se valida en el backend con el presupuesto (y de nuevo al confirmar). -->
              <div class="flex flex-col gap-2 border-t border-border pt-4 mt-2">
                @if (appliedCoupon()) {
                  <div class="flex items-center justify-between gap-3 text-sm">
                    <span>Cupón <strong>{{ appliedCoupon() }}</strong></span>
                    <button type="button" class="underline vy-muted" (click)="removeCoupon()">Quitar</button>
                  </div>
                } @else {
                  <form class="flex gap-2" (ngSubmit)="applyCoupon()">
                    <input
                      class="vy-input flex-1 min-w-0 uppercase"
                      placeholder="Código de descuento"
                      aria-label="Código de descuento"
                      [(ngModel)]="couponInput"
                      name="coupon"
                      autocomplete="off"
                    />
                    <button type="submit" class="vy-btn vy-btn--secundario vy-btn--chico" [disabled]="!couponInput.trim()">Aplicar</button>
                  </form>
                  @for (c of myCoupons(); track c.code) {
                    <button type="button" class="text-left text-sm underline" style="color: var(--vy-verde)" (click)="useCoupon(c.code)">
                      Usar tu cupón {{ c.code }} ({{ c.percent }}% off)
                    </button>
                  }
                }
                @if (quote()?.couponError; as couponError) {
                  <p class="text-sm text-error">{{ couponError }}</p>
                }
              </div>

              @if (quote(); as q) {
                @if (q.discountTotal > 0) {
                  <div class="flex justify-between gap-3 text-sm">
                    <span class="vy-muted">Subtotal</span>
                    <span class="font-bold whitespace-nowrap">{{ q.subtotal | pesos }}</span>
                  </div>
                  @for (d of q.discounts; track d.label) {
                    <div class="flex justify-between gap-3 text-sm" style="color: var(--vy-verde)">
                      <span>{{ d.label }}</span>
                      <span class="font-bold whitespace-nowrap">−{{ d.amount | pesos }}</span>
                    </div>
                  }
                }
              }
              <div class="flex justify-between items-center border-t border-border pt-4 mt-2">
                <span class="vy-label">Total</span>
                <span class="vy-precio">{{ (quote()?.total ?? cart.total()) | pesos }}</span>
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
  private destroyRef = inject(DestroyRef);
  private promotions = inject(PromotionService);

  couponInput = '';
  /** Cupón aplicado (lo que se manda en el presupuesto y en el pedido). */
  appliedCoupon = signal('');
  quote = cartQuote(this.appliedCoupon).quote;
  /** Cupones personales del usuario (premios de referidos), para usarlos con un toque. */
  myCoupons = signal<MyCoupon[]>([]);

  // Nombre y teléfono precargados desde la cuenta (se pueden cambiar si el
  // envío es para otra persona). `name` cae en el email si no cargó nombre.
  user = this.auth.currentUser();
  isLoggedIn = this.user !== null;
  /** Solo para invitados: logueado se usa el email de la cuenta. */
  email = '';
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
    this.error.set('');
    const rawPhone = this.shipping.phone?.trim() ?? '';
    const email = this.isLoggedIn ? null : this.email.trim() || null;
    if (!this.isLoggedIn && !email && !rawPhone) {
      this.error.set('Dejanos un email o un celular para contactarte.');
      return;
    }
    const phone = rawPhone ? normalizeArPhone(rawPhone) : null;
    if (rawPhone && !phone) {
      this.error.set(INVALID_PHONE_MESSAGE);
      return;
    }
    if (this.appliedCoupon() && this.quote()?.couponError) {
      this.error.set('El cupón no se puede usar en esta compra: quitalo o probá con otro.');
      return;
    }
    this.loading.set(true);
    try {
      const order = await this.orders.place(
        this.cart.items(),
        { ...this.shipping, phone },
        email,
        this.appliedCoupon() || null,
      );
      this.cart.clear();
      this.placedOrder.set(order);
      this.redirectToWhatsapp(order);
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

  whatsappEnabled = this.whatsapp.adminConfigured;

  constructor() {
    if (this.isLoggedIn) {
      this.promotions.myCoupons().then(list => this.myCoupons.set(list)).catch(() => {});
    }
  }

  applyCoupon(): void {
    this.useCoupon(this.couponInput);
  }

  useCoupon(code: string): void {
    this.appliedCoupon.set(code.trim().toUpperCase());
    this.couponInput = '';
  }

  removeCoupon(): void {
    this.appliedCoupon.set('');
  }

  whatsappLink(order: Order): string {
    return this.whatsapp.buildOrderLink(order);
  }

  cancelLink(order: Order): string {
    return this.whatsapp.buildCancelLink(order);
  }

  /** Lleva solo a WhatsApp con el pedido armado. Con una pausa corta para que
   * se vea la confirmación (y, si es invitado, que se cancela por WhatsApp);
   * el botón queda por si no abre. Mismo tab: un `window.open` después del
   * `await` lo bloquean los navegadores de celular. */
  private redirectToWhatsapp(order: Order): void {
    if (!this.whatsappEnabled) return;
    const timer = setTimeout(() => window.location.assign(this.whatsappLink(order)), 2500);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
