// Configuración del build de producción (`npm run build`). En el deploy con
// Caddy (ver deploy/) el frontend y la API se sirven desde el mismo dominio:
// Caddy manda `/api/*` al backend, así que alcanza con una ruta relativa y
// no hace falta CORS ni hardcodear el dominio.
export const environment = {
  apiBaseUrl: '/api/v1',
};
