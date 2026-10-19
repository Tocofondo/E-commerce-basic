import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../core/services/cart.service';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';
import { PesosPipe } from '../shared/store/pesos.pipe';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [RouterLink, VyLogoComponent, PesosPipe],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-4xl mx-auto flex flex-col gap-6">
      <h1 class="vy-titulo"><span class="vy-marker">Tu</span> <span class="vy-heavy">carrito</span></h1>

      @if (cart.items().length === 0) {
        <div class="text-center py-16 flex flex-col items-center gap-5">
          <vy-logo variante="sello" alto="64px" />
          <p class="vy-muted">Tu carrito está vacío. Date una vuelta por el catálogo.</p>
          <a routerLink="/productos" class="vy-btn">Ver productos</a>
        </div>
      } @else {
        <div class="flex flex-col gap-3">
          @for (item of cart.items(); track item.product.id) {
            <div class="vy-card flex flex-wrap sm:flex-nowrap items-center gap-4 p-4">
              <a [routerLink]="['/productos', item.product.id]" class="shrink-0">
                <img [src]="item.product.image" [alt]="item.product.name" class="w-20 h-20 object-cover rounded-xl" />
              </a>

              <div class="flex-1 min-w-0 flex flex-col gap-1">
                <a [routerLink]="['/productos', item.product.id]" class="vy-marker no-underline leading-tight">{{ item.product.name }}</a>
                <span class="vy-muted text-sm">{{ item.product.price | pesos }} c/u</span>
                @if (item.qty > item.product.stock) {
                  <span class="text-xs text-error">
                    {{ item.product.stock === 0 ? 'Sin stock: eliminalo para continuar.' : 'Solo quedan ' + item.product.stock + ' unidades.' }}
                  </span>
                }
              </div>

              <div class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 ml-auto">
                <div class="vy-cantidad">
                  <button type="button" (click)="cart.setQty(item.product.id, item.qty - 1)" aria-label="Restar">-</button>
                  <span>{{ item.qty }}</span>
                  <button
                    type="button"
                    (click)="cart.setQty(item.product.id, item.qty + 1)"
                    [disabled]="item.qty >= item.product.stock"
                    aria-label="Sumar"
                  >+</button>
                </div>
                <span class="vy-heavy text-lg min-w-[6.5rem] text-right">{{ item.product.price * item.qty | pesos }}</span>
                <button type="button" (click)="cart.remove(item.product.id)" class="text-sm text-error font-bold hover:underline cursor-pointer">
                  Eliminar
                </button>
              </div>
            </div>
          }
        </div>

        <div class="vy-card p-5 flex flex-col sm:flex-row sm:items-center gap-5">
          <div class="flex items-center gap-3 flex-1">
            <vy-logo class="shrink-0" variante="sello-simple" alto="48px" />
            <span class="vy-muted text-sm">Tu pedido va con yapa: un regalo de nuestra parte.</span>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="vy-label">Total</span>
            <span class="vy-precio">{{ cart.total() | pesos }}</span>
          </div>
        </div>

        <div class="flex flex-col items-end gap-2">
          @if (cart.overStock().length) {
            <p class="text-sm text-error">Ajustá las cantidades marcadas: el stock cambió desde que las agregaste.</p>
          }
          @if (cart.overStock().length) {
            <button type="button" class="vy-btn" disabled>Ir a pagar</button>
          } @else {
            <a routerLink="/checkout" class="vy-btn">Ir a pagar</a>
          }
        </div>
      }
      </div>
    </main>
  `,
})
export class CartPage {
  cart = inject(CartService);
}
