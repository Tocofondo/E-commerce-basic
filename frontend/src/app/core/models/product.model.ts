import { ProductCard } from '../../design-system/index';

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Product extends ProductCard {
  description: string;
  category: string;
  stock: number;
  // Galería completa (0..n). `image` (heredado de ProductCard) sigue
  // existiendo para no tocar los componentes que solo muestran una foto —
  // el backend lo calcula como `images[0].url`.
  images: ProductImage[];
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
