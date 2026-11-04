// Preparación de imágenes de producto antes de subirlas.
//
// El backend igual re-codifica todo (WEBP de hasta 1600px + miniatura, ver
// backend/app/modules/products/images.py): esto es para que subir desde el
// celu sea rápido. Una foto de 12MP / 5MB queda en ~400KB antes de salir, y
// formatos que el backend no acepta pero el navegador sí sabe leer (HEIC en
// Safari) se convierten acá.

/** Lo que acepta el backend (detectado por contenido). */
export const SERVER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Tope del archivo original que se elige (antes de achicarlo). */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
/** Tope que valida el backend (MAX_IMAGE_SIZE_MB) sobre lo que se sube. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Algo más que los 1600px que guarda el backend, para que el resize final
// (con mejor filtro) sea el de allá.
const MAX_SIDE = 2400;
const QUALITY = 0.9;
// Por debajo de esto, una imagen ya chica y en formato aceptado se sube tal
// cual (re-codificarla solo perdería calidad).
const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024;

export class ImagePrepareError extends Error {}

function renamed(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'imagen';
  return `${base}${ext}`;
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
}

/** Devuelve el archivo listo para subir: achicado/convertido si hace falta,
 * o el original si ya está bien. Rechaza con `ImagePrepareError` si el
 * navegador no lo puede leer como imagen. */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImagePrepareError(`"${file.name}" es demasiado pesada (máximo 40MB).`);
  }
  const accepted = SERVER_IMAGE_TYPES.includes(file.type);
  // GIF: el canvas se quedaría con un solo cuadro; que lo resuelva el backend.
  if (file.type === 'image/gif') return checkUploadSize(file);

  let bitmap: ImageBitmap;
  try {
    // `from-image`: aplica la rotación EXIF (fotos del celu "acostadas").
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (accepted) return checkUploadSize(file); // que decida el backend
    throw new ImagePrepareError(
      `"${file.name}" no se puede leer como imagen en este navegador. Usá JPG, PNG o WEBP.`,
    );
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (accepted && scale === 1 && file.size <= SMALL_ENOUGH_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return checkUploadSize(file);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // Safari viejo no codifica WEBP (devuelve PNG): ahí, JPEG.
    let blob = await toBlob(canvas, 'image/webp');
    let ext = '.webp';
    if (!blob || blob.type !== 'image/webp') {
      // JPEG no tiene transparencia: fondo blanco detrás (si no, queda negro).
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await toBlob(canvas, 'image/jpeg');
      ext = '.jpg';
    }
    if (!blob) return checkUploadSize(file);
    // Si re-codificar no ganó nada, mejor el original (si el backend lo acepta).
    if (accepted && blob.size >= file.size) return checkUploadSize(file);
    return checkUploadSize(new File([blob], renamed(file.name, ext), { type: blob.type }));
  } finally {
    bitmap.close();
  }
}

function checkUploadSize(file: File): File {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImagePrepareError(`"${file.name}" supera el tamaño máximo de 15MB.`);
  }
  return file;
}
