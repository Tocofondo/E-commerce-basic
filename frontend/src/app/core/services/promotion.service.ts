import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CartItem } from '../models/cart.model';
import {
  Coupon,
  CouponInput,
  MyCoupon,
  OrderQuote,
  Promotion,
  PromotionInput,
  ReferralStats,
} from '../models/promotion.model';
import { CartService } from './cart.service';

const URL = `${API_BASE_URL}/promotions`;

/** Body de `POST /orders/quote` (y lo que viaja en `POST /orders`). */
export function cartItemsBody(items: CartItem[]): { productId: number; qty: number }[] {
  return items.map(i => ({ productId: Number(i.product.id), qty: i.qty }));
}

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private http = inject(HttpClient);

  /** Promociones vigentes (público): para mostrarlas en la tienda. */
  active = signal<Promotion[]>([]);
  private activeLoaded = false;

  loadActive(): void {
    if (this.activeLoaded) return;
    this.activeLoaded = true;
    firstValueFrom(this.http.get<Promotion[]>(`${URL}/active`))
      .then(list => this.active.set(list))
      .catch(() => (this.activeLoaded = false)); // la tienda funciona igual sin esto
  }

  quote(items: CartItem[], couponCode: string | null, email: string | null): Promise<OrderQuote> {
    return firstValueFrom(
      this.http.post<OrderQuote>(`${API_BASE_URL}/orders/quote`, {
        items: cartItemsBody(items),
        couponCode: couponCode || null,
        email: email || null,
      }),
    );
  }

  // --- Cliente logueado ---

  myCoupons(): Promise<MyCoupon[]> {
    return firstValueFrom(this.http.get<MyCoupon[]>(`${URL}/coupons/me`));
  }

  myReferrals(): Promise<ReferralStats> {
    return firstValueFrom(this.http.get<ReferralStats>(`${URL}/referrals/me`));
  }

  // --- Admin ---

  listPromotions(): Promise<Promotion[]> {
    return firstValueFrom(this.http.get<Promotion[]>(URL));
  }

  savePromotion(id: number | null, data: PromotionInput): Promise<Promotion> {
    return firstValueFrom(
      id === null
        ? this.http.post<Promotion>(URL, data)
        : this.http.put<Promotion>(`${URL}/${id}`, data),
    ).finally(() => (this.activeLoaded = false));
  }

  deletePromotion(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${URL}/${id}`)).finally(
      () => (this.activeLoaded = false),
    );
  }

  listCoupons(): Promise<Coupon[]> {
    return firstValueFrom(this.http.get<Coupon[]>(`${URL}/coupons`));
  }

  saveCoupon(id: number | null, data: CouponInput): Promise<Coupon> {
    return firstValueFrom(
      id === null
        ? this.http.post<Coupon>(`${URL}/coupons`, data)
        : this.http.put<Coupon>(`${URL}/coupons/${id}`, data),
    );
  }

  deleteCoupon(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${URL}/coupons/${id}`));
  }
}

/**
 * Presupuesto del carrito con descuentos, que se vuelve a pedir al backend
 * cuando cambia el carrito o el cupón (con una pausa corta para no pedir uno
 * por cada click en +/-). Llamar en un constructor/campo (usa `effect`).
 * `null` mientras no hay respuesta o si el carrito está vacío.
 */
export function cartQuote(
  couponCode: Signal<string> = signal(''),
  email: Signal<string> = signal(''),
): { quote: Signal<OrderQuote | null>; loading: Signal<boolean> } {
  const cart = inject(CartService);
  const promotions = inject(PromotionService);
  const quote = signal<OrderQuote | null>(null);
  const loading = signal(false);
  let seq = 0;

  effect(onCleanup => {
    const items = cart.items();
    const code = couponCode().trim();
    const mail = email().trim();
    if (!items.length) {
      quote.set(null);
      return;
    }
    const mySeq = ++seq;
    loading.set(true);
    const timer = setTimeout(() => {
      promotions
        .quote(items, code, mail)
        .then(result => {
          if (mySeq === seq) quote.set(result);
        })
        // Sin presupuesto se muestra el total sin descuentos (el pedido igual
        // se calcula en el backend).
        .catch(() => {
          if (mySeq === seq) quote.set(null);
        })
        .finally(() => {
          if (mySeq === seq) loading.set(false);
        });
    }, 250);
    onCleanup(() => clearTimeout(timer));
  });

  return { quote, loading };
}
