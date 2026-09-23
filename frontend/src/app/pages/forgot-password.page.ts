import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsButton, DsInput } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsButton, DsInput],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div class="w-full max-w-sm bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-5">
        <div class="text-center">
          <h1 class="text-xl font-bold text-neutral-800">¿Olvidaste tu contraseña?</h1>
          <p class="text-sm text-neutral-500 mt-1">
            Ingresá tu email y te mandamos un link para restablecerla.
          </p>
        </div>

        @if (sent()) {
          <p class="text-sm text-center text-neutral-700 bg-neutral-50 border border-border rounded-lg p-3">
            Si el email está registrado, te enviamos un link para restablecer tu contraseña. Revisá tu casilla.
          </p>
        } @else {
          <form class="flex flex-col gap-4" (ngSubmit)="onSubmit()">
            <ds-input
              label="Email"
              type="email"
              placeholder="correo@ejemplo.com"
              [required]="true"
              [(ngModel)]="email"
              name="email"
            />

            <ds-button variant="primary" type="submit" [fullWidth]="true" [loading]="loading()">
              Enviar link
            </ds-button>
          </form>
        }

        <a routerLink="/login" class="text-sm text-center text-brand-600 hover:underline">Volver a ingresar</a>
      </div>
    </div>
  `,
})
export class ForgotPasswordPage {
  private auth = inject(AuthService);

  email = '';
  loading = signal(false);
  sent = signal(false);

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.auth.forgotPassword(this.email);
    } finally {
      this.loading.set(false);
    }
    this.sent.set(true);
  }
}
