import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DsButton, DsInput } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsButton, DsInput],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div class="w-full max-w-sm bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-5">
        <div class="text-center">
          <h1 class="text-xl font-bold text-neutral-800">Elegir nueva contraseña</h1>
        </div>

        @if (!token) {
          <p class="text-sm text-error text-center">
            Este link no es válido. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".
          </p>
        } @else if (done()) {
          <p class="text-sm text-center text-neutral-700 bg-neutral-50 border border-border rounded-lg p-3">
            Contraseña actualizada. Ya podés ingresar con la nueva.
          </p>
        } @else {
          <form class="flex flex-col gap-4" (ngSubmit)="onSubmit()">
            <ds-input
              label="Nueva contraseña"
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
              Cambiar contraseña
            </ds-button>
          </form>
        }

        <a routerLink="/login" class="text-sm text-center text-brand-600 hover:underline">Volver a ingresar</a>
      </div>
    </div>
  `,
})
export class ResetPasswordPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  token = this.route.snapshot.queryParamMap.get('token');
  password = '';
  confirmPassword = '';
  error = signal('');
  loading = signal(false);
  done = signal(false);

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
    if (!this.token) {
      return;
    }

    this.loading.set(true);
    let ok: boolean;
    try {
      ok = await this.auth.resetPassword(this.token, this.password);
    } finally {
      this.loading.set(false);
    }

    if (!ok) {
      this.error.set('El link es inválido o expiró. Pedí uno nuevo.');
      return;
    }

    this.done.set(true);
    setTimeout(() => this.router.navigate(['/login']), 2500);
  }
}
