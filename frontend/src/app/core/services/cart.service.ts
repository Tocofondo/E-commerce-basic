import { Injectable, computed, inject, signal } from '@angular/core';
import { CartItem } from '../models/cart.model';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';
import { Storage } from './storage';

const STORAGE_KEY = 'ec_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private storage = new Storage();
  private productsSrv = inject(ProductService);

  // Lo que se guardó en localStorage: incluye una copia del producto que
  // puede estar vieja (precio, stock, nombre). Solo se usa tal cual hasta
  // que llega el catálogo.
  private stored = signal<CartItem[]>(this.storage.load(STORAGE_KEY, [] as CartItem[]));

  /**
   * El carrito con los datos actuales del catálogo: cada item toma el
   * producto fresco de ProductService (precio y stock de hoy, no los del día
   * que se agregó). Una vez cargado el catálogo, los productos que ya no
   * existen se descartan.
   */
  items = computed<CartItem[]>(() => {
    const stored = this.stored();
    if (!this.productsSrv.loaded()) return stored;
    return stored.flatMap(item => {
      const fresh = this.productsSrv.getById(Number(item.product.id));
      return fresh ? [{ product: fresh, qty: item.qty }] : [];
    });
  });

  count = computed(() => this.items().reduce((sum, i) => sum + i.qty, 0));
  total = computed(() => this.items().reduce((sum, i) => sum + i.qty * i.product.price, 0));

  /** Items que piden más unidades de las que hay (el stock bajó desde que
   * se agregaron). El checkout no deja confirmar mientras haya alguno. */
  overStock = computed(() => this.items().filter(i => i.qty > i.product.stock));

  /** Cantidad de un producto que ya está en el carrito. */
  qtyOf(productId: string | number): number {
    return this.items().find(i => i.product.id === productId)?.qty ?? 0;
  }

  /** Agrega hasta completar el stock disponible. Devuelve cuántas unidades
   * se agregaron de verdad (puede ser menos que `qty`, o 0). */
  add(product: Product, qty = 1): number {
    const current = this.qtyOf(product.id);
    const added = Math.max(0, Math.min(qty, product.stock - current));
    if (added === 0) return 0;

    this.stored.update(list => {
      const existing = list.find(i => i.product.id === product.id);
      if (existing) {
        return list.map(i => (i.product.id === product.id ? { product, qty: current + added } : i));
      }
      return [...list, { product, qty: added }];
    });
    this.persist();
    return added;
  }

  setQty(productId: string | number, qty: number): void {
    if (qty <= 0) {
      this.remove(productId);
      return;
    }
    const product = this.items().find(i => i.product.id === productId)?.product;
    const capped = product ? Math.min(qty, product.stock) : qty;
    if (capped <= 0) {
      this.remove(productId);
      return;
    }
    this.stored.update(list =>
      list.map(i => (i.product.id === productId ? { product: product ?? i.product, qty: capped } : i)),
    );
    this.persist();
  }

  remove(productId: string | number): void {
    this.stored.update(list => list.filter(i => i.product.id !== productId));
    this.persist();
  }

  clear(): void {
    this.stored.set([]);
    this.persist();
  }

  private persist(): void {
    // Se guarda la versión fresca (con lo que el catálogo dice hoy).
    this.storage.save(STORAGE_KEY, this.items());
  }
}
