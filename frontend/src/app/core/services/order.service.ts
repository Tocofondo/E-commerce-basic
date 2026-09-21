import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../config/app.config.constants';
import { CartItem } from '../models/cart.model';
import { Order, OrderStatus, ShippingInfo } from '../models/order.model';

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
  userId: string;
  status: OrderStatus;
  total: number;
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
      },
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);

  orders = signal<Order[]>([]);

  /** Crea el pedido para el usuario autenticado (el backend lo infiere del token). */
  async place(items: CartItem[], shipping: ShippingInfo): Promise<Order> {
    const body = {
      items: items.map(i => ({ productId: Number(i.product.id), qty: i.qty })),
      shipping,
    };
    const res = await firstValueFrom(
      this.http.post<OrderResponse>(`${API_BASE_URL}/orders`, body),
    );
    const order = toOrder(res);
    this.orders.update(list => [order, ...list]);
    return order;
  }

  /** Pedidos del usuario autenticado. */
  async loadMine(): Promise<void> {
    const res = await firstValueFrom(this.http.get<OrderResponse[]>(`${API_BASE_URL}/orders/me`));
    this.orders.set(res.map(toOrder));
  }

  /** Todos los pedidos (solo admin). */
  async loadAll(): Promise<void> {
    const res = await firstValueFrom(this.http.get<OrderResponse[]>(`${API_BASE_URL}/orders`));
    this.orders.set(res.map(toOrder));
  }

  async updateStatus(id: number, status: OrderStatus): Promise<void> {
    const res = await firstValueFrom(
      this.http.patch<OrderResponse>(`${API_BASE_URL}/orders/${id}/status`, { status }),
    );
    const order = toOrder(res);
    this.orders.update(list => list.map(o => (o.id === id ? order : o)));
  }
}
