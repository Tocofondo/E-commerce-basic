import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput, VyLogoComponent],
  template: `
    <div class="vy-oscuro vy-tienda min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10">
      <a routerLink="/" aria-label="VACONYAPA, ir al inicio"><vy-logo alto="36px" /></a>
      <div class="w-full max-w-sm vy-card p-6 sm:p-8 flex flex-col gap-5">
        <div class="text-center">
          <h1 class="text-2xl leading-tight"><span class="vy-marker">¿Te olvidaste la</span> <span class="vy-heavy">contraseña?</span></h1>
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

            @if (error()) {
              <p class="text-sm text-error">{{ error() }}</p>
            }

            <button type="submit" class="vy-btn vy-btn--bloque" [disabled]="loading()">
              @if (loading()) { <span class="vy-btn-cargando"></span> }
              Enviar link
            </button>
          </form>
        }

        <a routerLink="/login" class="text-sm text-center font-bold hover:underline">Volver a ingresar</a>
      </div>
    </div>
  `,
})
export class ForgotPasswordPage {
  private auth = inject(AuthService);

  email = '';
  loading = signal(false);
  sent = signal(false);
  error = signal('');

  async onSubmit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    let errorMessage: string | null;
    try {
      errorMessage = await this.auth.forgotPassword(this.email);
    } finally {
      this.loading.set(false);
    }
    if (errorMessage) {
      this.error.set(errorMessage);
      return;
    }
    this.sent.set(true);
  }
}
