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

// Payload de creación/edición: sin `id` (lo asigna el backend), sin
// `image`/`images` (las imágenes se suben aparte vía
// ProductService.uploadImages, ver backend/app/modules/products) y sin
// `inStock` (derivado server-side de `stock`).
export type ProductInput = Omit<Product, 'id' | 'image' | 'images' | 'inStock'>;
