import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../config/app.config.constants';
import { Product, ProductImage, ProductInput } from '../models/product.model';
import { apiErrorMessage } from '../http-error';
import { AuthService } from './auth.service';

// El catálogo ahora vive en el backend (tabla `products`, ver
// backend/app/modules/products). El JSON usa camelCase (alias de Pydantic),
// así que la respuesta calza 1:1 con la interfaz `Product` sin mapeos.
//
// `image` viaja como "" cuando el producto no tiene ninguna imagen cargada
// (ProductRead.image en el backend); acá se pisa por un placeholder para
// que <ds-card-product> y el resto de las vistas no rendericen un <img>
// roto (no se puede tocar el design-system para manejar el string vacío ahí).
function withImageFallback(product: Product): Product {
  return product.image ? product : { ...product, image: PRODUCT_IMAGE_PLACEHOLDER };
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  /** Todo lo que trajo el backend: para un admin incluye los productos
   * pausados (`GET /products/all`), para el resto solo los activos. */
  allProducts = signal<Product[]>([]);
  /** Catálogo de la tienda: solo productos activos (los pausados no se
   * muestran ni se pueden comprar, aunque quien navega sea admin). */
  products = computed(() => this.allProducts().filter(p => p.isActive));
  /** Hay un pedido del catálogo en curso. */
  loading = signal(false);
  /** El catálogo se cargó al menos una vez: recién ahí "no está en
   * `products`" significa "no existe" y no "todavía no llegó". */
  loaded = signal(false);
  /** Mensaje del último error al cargar el catálogo ('' si salió bien). */
  error = signal('');
  /** Id del último `refresh()`: una respuesta de un pedido anterior (ej. el
   * catálogo público que llega después del de admin) se descarta. */
  private refreshSeq = 0;

  constructor() {
    // Carga inicial y recarga al entrar/salir como admin (cambia el endpoint).
    effect(() => {
      this.auth.isAdmin();
      untracked(() => this.refresh());
    });
  }

  /** Vuelve a pedir el catálogo completo al backend. Nunca rechaza: si
   * falla, deja el mensaje en `error` para que la vista ofrezca reintentar. */
  async refresh(): Promise<void> {
    const seq = ++this.refreshSeq;
    this.loading.set(true);
    this.error.set('');
    try {
      const url = this.auth.isAdmin() ? `${API_BASE_URL}/products/all` : `${API_BASE_URL}/products`;
      const list = await firstValueFrom(this.http.get<Product[]>(url));
      if (seq !== this.refreshSeq) return;
      this.allProducts.set(list.map(withImageFallback));
      this.loaded.set(true);
    } catch (err) {
      if (seq !== this.refreshSeq) return;
      this.error.set(apiErrorMessage(err, 'No se pudo cargar el catálogo.'));
    } finally {
      if (seq === this.refreshSeq) this.loading.set(false);
    }
  }

  /** Busca en el catálogo ya cargado en memoria (no pega a la API). Solo
   * productos activos: es lo que usan la tienda y el carrito. */
  getById(id: number): Product | undefined {
    return this.products().find(p => Number(p.id) === id);
  }

  /** Como `getById` pero incluye los pausados (para el admin). */
  getAnyById(id: number): Product | undefined {
    return this.allProducts().find(p => Number(p.id) === id);
  }

  private replace(updated: Product): void {
    this.allProducts.update(list => list.map(p => (p.id === updated.id ? updated : p)));
  }

  async create(data: ProductInput): Promise<Product> {
    const created = withImageFallback(
      await firstValueFrom(this.http.post<Product>(`${API_BASE_URL}/products`, data)),
    );
    this.allProducts.update(list => [...list, created]);
    return created;
  }

  async update(id: number, data: Partial<ProductInput> & { isActive?: boolean }): Promise<Product> {
    const updated = withImageFallback(
      await firstValueFrom(this.http.patch<Product>(`${API_BASE_URL}/products/${id}`, data)),
    );
    this.replace(updated);
    return updated;
  }

  /** Pausa el producto (soft delete en el backend): deja de verse en la
   * tienda pero los pedidos viejos conservan su imagen. Se puede reactivar. */
  async pause(id: number): Promise<Product> {
    const paused = withImageFallback(
      await firstValueFrom(this.http.delete<Product>(`${API_BASE_URL}/products/${id}`)),
    );
    this.replace(paused);
    return paused;
  }

  reactivate(id: number): Promise<Product> {
    return this.update(id, { isActive: true });
  }

  /** Sube una o varias imágenes para un producto ya creado
   * (POST /products/{id}/images, multipart). El backend valida tipo
   * (png/jpeg/webp/gif) y tamaño máximo — ver backend/app/modules/products/service.py.
   * Devuelve las imágenes nuevas y actualiza el producto en el signal local
   * (recalculando `image` como la primera de la galería). */
  async uploadImages(productId: number, files: File[]): Promise<ProductImage[]> {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);

    const newImages = await firstValueFrom(
      this.http.post<ProductImage[]>(`${API_BASE_URL}/products/${productId}/images`, formData),
    );

    this.allProducts.update(list =>
      list.map(p => {
        if (Number(p.id) !== productId) return p;
        const images = [...p.images, ...newImages];
        return withImageFallback({ ...p, images, image: images[0]?.url ?? '' });
      }),
    );
    return newImages;
  }

  async deleteImage(productId: number, imageId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${API_BASE_URL}/products/${productId}/images/${imageId}`),
    );

    this.allProducts.update(list =>
      list.map(p => {
        if (Number(p.id) !== productId) return p;
        const images = p.images.filter(img => img.id !== imageId);
        return withImageFallback({ ...p, images, image: images[0]?.url ?? '' });
      }),
    );
  }
}
