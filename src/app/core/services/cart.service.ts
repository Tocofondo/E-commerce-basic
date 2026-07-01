import { Injectable, computed, signal } from '@angular/core';
import { CartItem } from '../models/cart.model';
import { Product } from '../models/product.model';
import { Storage } from './storage';

const STORAGE_KEY = 'ec_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private storage = new Storage();

  items = signal<CartItem[]>(this.storage.load(STORAGE_KEY, [] as CartItem[]));
  count = computed(() => this.items().reduce((sum, i) => sum + i.qty, 0));
  total = computed(() => this.items().reduce((sum, i) => sum + i.qty * i.product.price, 0));

  add(product: Product, qty = 1): void {
    this.items.update(list => {
      const existing = list.find(i => i.product.id === product.id);
      if (existing) {
        return list.map(i =>
          i.product.id === product.id ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [...list, { product, qty }];
    });
    this.persist();
  }

  setQty(productId: string | number, qty: number): void {
    if (qty <= 0) {
      this.remove(productId);
      return;
    }
    this.items.update(list =>
      list.map(i => (i.product.id === productId ? { ...i, qty } : i))
    );
    this.persist();
  }

  remove(productId: string | number): void {
    this.items.update(list => list.filter(i => i.product.id !== productId));
    this.persist();
  }

  clear(): void {
    this.items.set([]);
    this.persist();
  }

  private persist(): void {
    this.storage.save(STORAGE_KEY, this.items());
  }
}
