import { environment } from '../../../environments/environment';

// URL base de la API del backend. Sale de src/environments/: en desarrollo
// apunta al uvicorn local; en el build de producción es relativa (`/api/v1`)
// porque Caddy sirve frontend y API desde el mismo dominio (ver deploy/).
export const API_BASE_URL = environment.apiBaseUrl;
