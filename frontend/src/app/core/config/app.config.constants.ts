// Número de WhatsApp del admin, formato internacional sin "+" ni espacios (ej. 5493811234567).
// Reemplazar por el número real antes de usar en producción.
export const ADMIN_WHATSAPP = '549XXXXXXXXXX';

// Placeholder para productos sin ninguna imagen cargada (ver
// backend/app/modules/products: `ProductRead.image` es "" cuando `images`
// está vacío). Data URI inline: sin pegarle a un servidor externo ni
// depender de un asset del bundle.
export const PRODUCT_IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f5f5f5"/>
      <path d="M60 130 L90 95 L115 120 L135 90 L150 130 Z" fill="#d4d4d4"/>
      <circle cx="75" cy="75" r="12" fill="#d4d4d4"/>
    </svg>`,
  );
