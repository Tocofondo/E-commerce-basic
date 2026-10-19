import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { User, UserRole } from '../models/user.model';
import { Storage } from './storage';
import { apiErrorMessage } from '../http-error';

const STORAGE_KEY = 'ec_session';

interface Session {
  token: string;
  user: User;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface MeResponse {
  id: string;
  email: string;
  phone: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface RegisterData {
  email: string;
  phone: string;
  password: string;
  fullName?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private storage = new Storage();

  // Token + user se guardan juntos: al recargar la página se hidrata el
  // signal directo desde localStorage, sin esperar ningún request (los
  // guards de rutas necesitan la respuesta sincrónica).
  private session = signal<Session | null>(this.storage.load<Session | null>(STORAGE_KEY, null));

  currentUser = computed(() => this.session()?.user ?? null);
  token = computed(() => this.session()?.token ?? null);
  isLoggedIn = computed(() => this.session() !== null);
  isAdmin = computed(() => this.currentUser()?.role === 'admin');

  /** Devuelve null si el login fue exitoso, o el mensaje de error para
   * mostrar (credenciales inválidas, demasiados intentos, sin conexión...). */
  async login(email: string, password: string): Promise<string | null> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);

    try {
      const tokenResponse = await firstValueFrom(
        this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      await this.hydrateSession(tokenResponse.access_token);
      return null;
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return 'Email o contraseña incorrectos.';
      }
      return apiErrorMessage(err, 'No se pudo iniciar sesión. Probá de nuevo.');
    }
  }

  /**
   * Crea la cuenta contra `POST /auth/register` y, si sale bien, loguea de
   * una (mismo endpoint que usaría el usuario a mano después). Devuelve un
   * mensaje de error si falla (ej. email ya registrado), o null si salió bien.
   */
  async register(data: RegisterData): Promise<string | null> {
    try {
      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/auth/register`, {
          email: data.email,
          phone: data.phone,
          password: data.password,
          full_name: data.fullName || null,
        }),
      );
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        return 'Ya existe una cuenta con ese email.';
      }
      return apiErrorMessage(err, 'No se pudo crear la cuenta. Revisá los datos y probá de nuevo.');
    }

    const loginError = await this.login(data.email, data.password);
    return loginError
      ? 'Cuenta creada, pero no se pudo iniciar sesión automáticamente. Ingresá manualmente.'
      : null;
  }

  /** Devuelve null si el pedido salió (el backend responde igual exista o
   * no el email), o un mensaje si no se pudo enviar (sin conexión,
   * demasiados pedidos seguidos). */
  async forgotPassword(email: string): Promise<string | null> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/forgot-password`, { email }));
      return null;
    } catch (err) {
      return apiErrorMessage(err, 'No se pudo enviar el pedido. Probá de nuevo.');
    }
  }

  /** Devuelve null si la contraseña se actualizó, o el mensaje de error
   * (link inválido/expirado/ya usado, sin conexión...). */
  async resetPassword(token: string, newPassword: string): Promise<string | null> {
    try {
      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/auth/reset-password`, {
          token,
          new_password: newPassword,
        }),
      );
      return null;
    } catch (err) {
      return apiErrorMessage(err, 'El link es inválido o expiró. Pedí uno nuevo.');
    }
  }

  logout(): void {
    this.session.set(null);
    this.storage.save(STORAGE_KEY, null);
  }

  private async hydrateSession(token: string): Promise<void> {
    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const user: User = {
      id: me.id,
      name: me.full_name ?? me.email,
      email: me.email,
      phone: me.phone,
      role: me.role,
    };

    this.session.set({ token, user });
    this.storage.save(STORAGE_KEY, this.session());
  }
}
