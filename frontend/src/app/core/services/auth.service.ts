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
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
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

    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      }),
    );

    const user: User = {
      id: me.id,
      name: me.full_name ?? me.email,
      email: me.email,
      role: me.role,
    };

    this.session.set({ token: tokenResponse.access_token, user });
    this.storage.save(STORAGE_KEY, this.session());
    return true;
  }

  logout(): void {
    this.session.set(null);
    this.storage.save(STORAGE_KEY, null);
  }
}
