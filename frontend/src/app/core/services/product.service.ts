import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../config/app.config.constants';
import { Product, ProductImage, ProductInput } from '../models/product.model';
import { apiErrorMessage } from '../http-error';

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

  products = signal<Product[]>([]);
  /** Hay un pedido del catálogo en curso. */
  loading = signal(false);
  /** El catálogo se cargó al menos una vez: recién ahí "no está en
   * `products`" significa "no existe" y no "todavía no llegó". */
  loaded = signal(false);
  /** Mensaje del último error al cargar el catálogo ('' si salió bien). */
  error = signal('');

  constructor() {
    this.refresh();
  }

  /** Vuelve a pedir el catálogo completo al backend. Nunca rechaza: si
   * falla, deja el mensaje en `error` para que la vista ofrezca reintentar. */
  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = await firstValueFrom(this.http.get<Product[]>(`${API_BASE_URL}/products`));
      this.products.set(list.map(withImageFallback));
      this.loaded.set(true);
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudo cargar el catálogo.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Busca en el catálogo ya cargado en memoria (no pega a la API). */
  getById(id: number): Product | undefined {
    return this.products().find(p => Number(p.id) === id);
  }

  async create(data: ProductInput): Promise<Product> {
    const created = withImageFallback(
      await firstValueFrom(this.http.post<Product>(`${API_BASE_URL}/products`, data)),
    );
    this.products.update(list => [...list, created]);
    return created;
  }

  async update(id: number, data: ProductInput): Promise<Product> {
    const updated = withImageFallback(
      await firstValueFrom(this.http.patch<Product>(`${API_BASE_URL}/products/${id}`, data)),
    );
    this.products.update(list => list.map(p => (Number(p.id) === id ? updated : p)));
    return updated;
  }

  async remove(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/products/${id}`));
    this.products.update(list => list.filter(p => Number(p.id) !== id));
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

    this.products.update(list =>
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

    this.products.update(list =>
      list.map(p => {
        if (Number(p.id) !== productId) return p;
        const images = p.images.filter(img => img.id !== imageId);
        return withImageFallback({ ...p, images, image: images[0]?.url ?? '' });
      }),
    );
  }
}
