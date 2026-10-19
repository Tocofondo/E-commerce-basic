import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput, VyLogoComponent],
  template: `
    <div class="vy-oscuro vy-tienda min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10">
      <a routerLink="/" aria-label="VACONYAPA, ir al inicio"><vy-logo alto="36px" /></a>
      <div class="w-full max-w-sm vy-card p-6 sm:p-8 flex flex-col gap-5">
        <div class="text-center">
          <h1 class="text-2xl leading-tight"><span class="vy-marker">Ingresá a</span> <span class="vy-heavy">tu cuenta</span></h1>
          <p class="text-sm text-neutral-500 mt-1">Para seguir tus pedidos y comprar más rápido.</p>
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

          <a routerLink="/forgot-password" class="text-sm font-bold hover:underline self-end">¿Olvidaste tu contraseña?</a>

          @if (error()) {
            <p class="text-sm text-error">{{ error() }}</p>
          }

          <button type="submit" class="vy-btn vy-btn--bloque" [disabled]="loading()">
            @if (loading()) { <span class="vy-btn-cargando"></span> }
            Ingresar
          </button>
        </form>

        <p class="text-sm text-center text-neutral-500">
          ¿No tenés cuenta?
          <a routerLink="/register" class="font-bold hover:underline">Registrate</a>
        </p>

        <a routerLink="/" class="text-sm text-center font-bold hover:underline">Volver a la tienda</a>
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
    let errorMessage: string | null;
    try {
      errorMessage = await this.auth.login(this.email, this.password);
    } finally {
      this.loading.set(false);
    }

    if (errorMessage) {
      this.error.set(errorMessage);
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
