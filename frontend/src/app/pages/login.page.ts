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

          @if (error()) {
            <p class="text-sm text-error">{{ error() }}</p>
          }

          <ds-button variant="primary" type="submit" [fullWidth]="true">Ingresar</ds-button>
        </form>

        <div class="text-xs text-neutral-500 bg-neutral-50 border border-border rounded-lg p-3 leading-relaxed">
          <p class="font-medium text-neutral-700 mb-1">Cuentas demo</p>
          <p>Admin: admin&#64;demo.com / admin</p>
          <p>Cliente: cliente&#64;demo.com / cliente</p>
        </div>

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

  onSubmit(): void {
    const ok = this.auth.login(this.email, this.password);
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
