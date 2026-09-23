import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DsButton, DsInput } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsButton, DsInput],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div class="w-full max-w-sm bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-5">
        <div class="text-center">
          <h1 class="text-xl font-bold text-neutral-800">Ingresar</h1>
          <p class="text-sm text-neutral-500 mt-1">Accedé a tu cuenta de Mi Tienda</p>
        </div>

        <form class="flex flex-col gap-4" (ngSubmit)="onSubmit()">
          <ds-input
            label="Email"
            type="email"
            placeholder="correo@ejemplo.com"
            [required]="true"
            [(ngModel)]="email"
            name="email"
          />
          <ds-input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            [required]="true"
            [(ngModel)]="password"
            name="password"
          />

          <a routerLink="/forgot-password" class="text-sm text-brand-600 hover:underline self-end">¿Olvidaste tu contraseña?</a>

          @if (error()) {
            <p class="text-sm text-error">{{ error() }}</p>
          }

          <ds-button variant="primary" type="submit" [fullWidth]="true" [loading]="loading()">
            Ingresar
          </ds-button>
        </form>

        <p class="text-sm text-center text-neutral-500">
          ¿No tenés cuenta?
          <a routerLink="/register" class="text-brand-600 hover:underline">Registrate</a>
        </p>

        <a routerLink="/" class="text-sm text-center text-brand-600 hover:underline">Volver a la tienda</a>
      </div>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  async onSubmit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    let ok: boolean;
    try {
      ok = await this.auth.login(this.email, this.password);
    } finally {
      this.loading.set(false);
    }

    if (!ok) {
      this.error.set('Email o contraseña incorrectos.');
      return;
    }

    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect) {
      this.router.navigateByUrl(redirect);
    } else if (this.auth.isAdmin()) {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
