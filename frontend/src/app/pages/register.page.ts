import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';
import { AuthService } from '../core/services/auth.service';
import { INVALID_PHONE_MESSAGE, normalizeArPhone } from '../core/phone';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput, VyLogoComponent],
  template: `
    <div class="vy-oscuro vy-tienda min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10">
      <a routerLink="/" aria-label="VACONYAPA, ir al inicio"><vy-logo alto="36px" /></a>
      <div class="w-full max-w-sm vy-card p-6 sm:p-8 flex flex-col gap-5">
        <div class="text-center">
          <h1 class="text-2xl leading-tight"><span class="vy-marker">Creá</span> <span class="vy-heavy">tu cuenta</span></h1>
          <p class="text-sm text-neutral-500 mt-1">Registrate en VACONYAPA</p>
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
            label="Celular"
            type="tel"
            placeholder="341 555-1234"
            hint="Con código de área, sin 0 ni 15"
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

          <button type="submit" class="vy-btn vy-btn--bloque" [disabled]="loading()">
            @if (loading()) { <span class="vy-btn-cargando"></span> }
            Crear cuenta
          </button>
        </form>

        <p class="text-sm text-center text-neutral-500">
          ¿Ya tenés cuenta?
          <a routerLink="/login" class="font-bold hover:underline">Ingresá</a>
        </p>

        <a routerLink="/" class="text-sm text-center font-bold hover:underline">Volver a la tienda</a>
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
    const phone = normalizeArPhone(this.phone);
    if (!phone) {
      this.error.set(INVALID_PHONE_MESSAGE);
      return;
    }

    this.loading.set(true);
    let errorMessage: string | null;
    try {
      errorMessage = await this.auth.register({
        email: this.email,
        phone,
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
