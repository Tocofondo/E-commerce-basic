import { Injectable, signal } from '@angular/core';
import { CartItem } from '../models/cart.model';
import { Order, OrderStatus, ShippingInfo } from '../models/order.model';
import { Storage } from './storage';

const STORAGE_KEY = 'ec_orders';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private storage = new Storage();
  private nextId = 1;

  orders = signal<Order[]>(this.storage.load(STORAGE_KEY, [] as Order[]));

  constructor() {
    this.nextId = Math.max(...this.orders().map(o => o.id), 0) + 1;
  }

  place(userId: number, items: CartItem[], shipping: ShippingInfo): Order {
    const order: Order = {
      id: this.nextId++,
      userId,
      items,
      total: items.reduce((sum, i) => sum + i.qty * i.product.price, 0),
      status: 'pendiente',
      createdAt: new Date().toISOString(),
      shipping,
    };
    this.orders.update(list => [...list, order]);
    this.persist();
    return order;
  }

  getByUser(userId: number): Order[] {
    return this.orders()
      .filter(o => o.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateStatus(id: number, status: OrderStatus): void {
    this.orders.update(list =>
      list.map(o => (o.id === id ? { ...o, status } : o))
    );
    this.persist();
  }

  private persist(): void {
    this.storage.save(STORAGE_KEY, this.orders());
  }
}
