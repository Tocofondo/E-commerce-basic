import { ProductCard } from '../../design-system/index';

export interface ProductImage {
  id: string;
  /** WEBP de hasta 1600px (detalle del producto). */
  url: string;
  /** WEBP de hasta 640px (cards, carrito, admin). Igual a `url` en imágenes
   * subidas antes del procesamiento que no se reprocesaron. */
  thumbUrl: string;
  /** Medidas de `url`; `null` en imágenes viejas sin reprocesar. */
  width: number | null;
  height: number | null;
  position: number;
}

export interface Product extends ProductCard {
  description: string;
  category: string;
  stock: number;
  /** `false` = pausado por el admin (soft delete): fuera de la tienda. */
  isActive: boolean;
  // Galería completa (0..n). `image` (heredado de ProductCard) sigue
  // existiendo para no tocar los componentes que solo muestran una foto —
  // el backend lo calcula como `images[0].url`.
  images: ProductImage[];
  /** Portada en chico (`images[0].thumbUrl`), para las cards. Puede faltar en
   * copias viejas del carrito guardadas en localStorage: usar `thumb || image`. */
  thumb?: string;
}

// Payload de creación/edición desde el admin. Sin `id` (lo asigna el
// backend), sin `image`/`images` (se suben aparte vía
// ProductService.uploadImages), sin `inStock` (derivado de `stock`) y sin
// `rating`/`reviewCount` (el form no los edita). La edición es parcial
// (PATCH): lo que no viaja queda como estaba; `null` explícito lo borra
// (ej. sacar el badge o el precio anterior).
export interface ProductInput {
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice: number | null;
  stock: number;
  badge: Product['badge'] | null;
}
