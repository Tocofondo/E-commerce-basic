import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DsButton, DsInput } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsButton, DsInput],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-8">
      <div class="w-full max-w-sm bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-5">
        <div class="text-center">
          <h1 class="text-xl font-bold text-neutral-800">Crear cuenta</h1>
          <p class="text-sm text-neutral-500 mt-1">Registrate en Mi Tienda</p>
        </div>

        <form class="flex flex-col gap-4" (ngSubmit)="onSubmit()">
          <ds-input
            label="Nombre"
            type="text"
            placeholder="Tu nombre"
            [(ngModel)]="fullName"
            name="fullName"
          />
          <ds-input
            label="Email"
            type="email"
            placeholder="correo@ejemplo.com"
            [required]="true"
            [(ngModel)]="email"
            name="email"
          />
          <ds-input
            label="Teléfono"
            type="tel"
            placeholder="5493811234567"
            [required]="true"
            [(ngModel)]="phone"
            name="phone"
          />
          <ds-input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            hint="Mínimo 8 caracteres"
            [required]="true"
            [(ngModel)]="password"
            name="password"
          />
          <ds-input
            label="Repetir contraseña"
            type="password"
            placeholder="••••••••"
            [required]="true"
            [(ngModel)]="confirmPassword"
            name="confirmPassword"
          />

          @if (error()) {
            <p class="text-sm text-error">{{ error() }}</p>
          }

          <ds-button variant="primary" type="submit" [fullWidth]="true" [loading]="loading()">
            Crear cuenta
          </ds-button>
        </form>

        <p class="text-sm text-center text-neutral-500">
          ¿Ya tenés cuenta?
          <a routerLink="/login" class="text-brand-600 hover:underline">Ingresá</a>
        </p>

        <a routerLink="/" class="text-sm text-center text-brand-600 hover:underline">Volver a la tienda</a>
      </div>
    </div>
  `,
})
export class RegisterPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  fullName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';
  error = signal('');
  loading = signal(false);

  async onSubmit(): Promise<void> {
    this.error.set('');

    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    let errorMessage: string | null;
    try {
      errorMessage = await this.auth.register({
        email: this.email,
        phone: this.phone,
        password: this.password,
        fullName: this.fullName,
      });
    } finally {
      this.loading.set(false);
    }

    if (errorMessage) {
      this.error.set(errorMessage);
      return;
    }

    this.router.navigate(['/']);
  }
}
