import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../config/app.config.constants';
import { CartItem } from '../models/cart.model';
import { Order, OrderStatus, ShippingInfo } from '../models/order.model';
import { apiErrorMessage } from '../http-error';
import { AppliedDiscount } from '../models/promotion.model';
import { cartItemsBody } from './promotion.service';

// Transiciones de estado que acepta el backend (mismo mapa que
// ALLOWED_TRANSITIONS en backend/app/modules/orders/service.py).
// `cancelado` y `entregado` son finales; cancelar repone el stock.
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pendiente: ['pagado', 'cancelado'],
  pagado: ['enviado', 'cancelado'],
  enviado: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

// Forma que devuelve el backend para cada item de pedido: un snapshot del
// producto al momento de la compra, no el `Product` completo del catálogo
// (ver backend/app/modules/orders/schemas.py -> OrderItemRead).
interface OrderItemResponse {
  productId: number | null;
  productName: string;
  productImage: string;
  unitPrice: number;
  qty: number;
}

interface OrderResponse {
  id: number;
  userId: string | null;
  customerEmail: string | null;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  total: number;
  discounts: AppliedDiscount[];
  couponCode: string | null;
  createdAt: string;
  items: OrderItemResponse[];
  shipping: ShippingInfo;
}

// El frontend modela cada item de pedido como `CartItem` (`{ product, qty }`)
// para reusar los mismos templates que el carrito. Reconstruimos un `Product`
// mínimo a partir del snapshot: category/description/stock no viajan en el
// pedido (no hacen falta para mostrarlo) y quedan vacíos/en 0.
function toOrder(res: OrderResponse): Order {
  return {
    id: res.id,
    userId: res.userId,
    customerEmail: res.customerEmail,
    subtotal: res.subtotal,
    discountTotal: res.discountTotal,
    discounts: res.discounts,
    couponCode: res.couponCode,
    total: res.total,
    status: res.status,
    createdAt: res.createdAt,
    shipping: res.shipping,
    items: res.items.map((i): CartItem => ({
      qty: i.qty,
      product: {
        id: i.productId ?? 0,
        name: i.productName,
        image: i.productImage || PRODUCT_IMAGE_PLACEHOLDER,
        images: [],
        price: i.unitPrice,
        description: '',
        category: '',
        stock: 0,
        isActive: true,
      },
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);

  orders = signal<Order[]>([]);
  loading = signal(false);
  /** Mensaje del último error al cargar pedidos ('' si salió bien). */
  error = signal('');
  /** Id del último `load()`: una respuesta de un pedido anterior se descarta. */
  private loadSeq = 0;

  /** Crea el pedido para el usuario autenticado (el backend lo infiere del
   * token) o, sin sesión, como invitado con el `email` que dejó (logueado se
   * ignora: va el de la cuenta). El backend aplica promociones y el cupón. */
  async place(
    items: CartItem[],
    shipping: ShippingInfo,
    email: string | null = null,
    couponCode: string | null = null,
  ): Promise<Order> {
    const body = {
      items: cartItemsBody(items),
      shipping,
      email,
      couponCode: couponCode || null,
    };
    const res = await firstValueFrom(
      this.http.post<OrderResponse>(`${API_BASE_URL}/orders`, body),
    );
    const order = toOrder(res);
    this.orders.update(list => [order, ...list]);
    return order;
  }

  /** Pedidos del usuario autenticado. */
  loadMine(): Promise<void> {
    return this.load(`${API_BASE_URL}/orders/me`);
  }

  /** Todos los pedidos (solo admin). */
  loadAll(): Promise<void> {
    return this.load(`${API_BASE_URL}/orders`);
  }

  /** Nunca rechaza: si falla deja el mensaje en `error`. Vacía la lista
   * antes de pedir, porque `orders` se comparte entre "mis pedidos" y el
   * admin: sin esto, un admin que pasa de /admin/pedidos a /mis-pedidos
   * veía por un momento los pedidos de todos. Por lo mismo, si mientras
   * tanto arrancó otro `load()`, la respuesta de este se descarta. */
  private async load(url: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.orders.set([]);
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await firstValueFrom(this.http.get<OrderResponse[]>(url));
      if (seq === this.loadSeq) this.orders.set(res.map(toOrder));
    } catch (err) {
      if (seq === this.loadSeq) {
        this.error.set(apiErrorMessage(err, 'No se pudieron cargar los pedidos.'));
      }
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  /** El cliente cancela su propio pedido (solo `pendiente`; el backend repone el stock). */
  async cancelMine(id: number): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<OrderResponse>(`${API_BASE_URL}/orders/${id}/cancel`, {}),
    );
    const order = toOrder(res);
    this.orders.update(list => list.map(o => (o.id === id ? order : o)));
  }

  async updateStatus(id: number, status: OrderStatus): Promise<void> {
    const res = await firstValueFrom(
      this.http.patch<OrderResponse>(`${API_BASE_URL}/orders/${id}/status`, { status }),
    );
    const order = toOrder(res);
    this.orders.update(list => list.map(o => (o.id === id ? order : o)));
  }
}
