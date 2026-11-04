import { ProductImage } from '../../core/models/product.model';

// Lado mayor de la miniatura que genera el backend (THUMB_MAX_SIDE en
// backend/app/modules/products/images.py).
const THUMB_MAX_SIDE = 640;

/** `srcset` con la miniatura y la grande, con el ancho real de cada una:
 * así el navegador baja la chica en las cards del celu y la grande solo
 * donde hace falta (pantallas grandes/retina). `null` para imágenes viejas
 * sin reprocesar (sin medidas ni miniatura): ahí va solo `src`. */
export function productSrcset(image: ProductImage | undefined): string | null {
  if (!image?.width || !image.height || image.thumbUrl === image.url) return null;
  const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(image.width, image.height));
  const thumbWidth = Math.round(image.width * scale);
  return `${image.thumbUrl} ${thumbWidth}w, ${image.url} ${image.width}w`;
}
