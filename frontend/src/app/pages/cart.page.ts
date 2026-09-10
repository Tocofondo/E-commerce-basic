import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DsButton, DsPrice } from '../design-system/index';
import { CartService } from '../core/services/cart.service';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [RouterLink, DsButton, DsPrice],
  template: `
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Carrito</h1>

      @if (cart.items().length === 0) {
        <div class="text-center py-16 flex flex-col items-center gap-4">
          <p class="text-neutral-500">Tu carrito está vacío.</p>
          <a routerLink="/productos">
            <ds-button variant="primary">Ver productos</ds-button>
          </a>
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          @for (item of cart.items(); track item.product.id) {
            <div class="flex items-center gap-4 bg-surface border border-border rounded-xl p-4">
              <img [src]="item.product.image" [alt]="item.product.name" class="w-20 h-20 object-cover rounded-lg" />

              <div class="flex-1 flex flex-col gap-1">
                <span class="text-sm font-medium text-neutral-800">{{ item.product.name }}</span>
                <ds-price [current]="item.product.price" size="sm" />
              </div>

              <div class="flex items-center border border-border rounded-lg">
                <button (click)="cart.setQty(item.product.id, item.qty - 1)" class="px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100" aria-label="Restar">-</button>
                <span class="px-3 text-sm font-medium">{{ item.qty }}</span>
                <button (click)="cart.setQty(item.product.id, item.qty + 1)" class="px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100" aria-label="Sumar">+</button>
              </div>

              <button (click)="cart.remove(item.product.id)" class="text-sm text-error hover:underline">
                Eliminar
              </button>
            </div>
          }
        </div>

        <div class="flex justify-end items-center gap-4 border-t border-border pt-6">
          <span class="text-neutral-600">Total:</span>
          <ds-price [current]="cart.total()" size="lg" />
        </div>

        <div class="flex justify-end">
          <ds-button variant="primary" size="lg" (clicked)="router.navigate(['/checkout'])">
            Ir a pagar
          </ds-button>
        </div>
      }
    </main>
  `,
})
export class CartPage {
  cart = inject(CartService);
  router = inject(Router);
}
