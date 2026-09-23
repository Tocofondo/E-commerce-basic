import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { User, UserRole } from '../models/user.model';
import { Storage } from './storage';

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

  /** Devuelve true si el login fue exitoso, false si las credenciales son inválidas. */
  async login(email: string, password: string): Promise<boolean> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);

    let tokenResponse: LoginResponse;
    try {
      tokenResponse = await firstValueFrom(
        this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    } catch {
      // Credenciales incorrectas (401) o backend no disponible: en ambos
      // casos el login simplemente falla, el llamador decide qué mostrar.
      return false;
    }

    await this.hydrateSession(tokenResponse.access_token);
    return true;
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
    } catch (err: any) {
      if (err?.status === 409) {
        return 'Ya existe una cuenta con ese email.';
      }
      return 'No se pudo crear la cuenta. Probá de nuevo.';
    }

    const ok = await this.login(data.email, data.password);
    return ok ? null : 'Cuenta creada, pero no se pudo iniciar sesión automáticamente. Ingresá manualmente.';
  }

  /** Siempre resuelve (el backend no revela si el email existe o no). */
  async forgotPassword(email: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/forgot-password`, { email }));
    } catch {
      // Se ignora: el backend devuelve 200 siempre; un error acá es de red.
    }
  }

  /** Devuelve true si la contraseña se actualizó, false si el token es inválido/expiró. */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/auth/reset-password`, {
          token,
          new_password: newPassword,
        }),
      );
      return true;
    } catch {
      return false;
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
