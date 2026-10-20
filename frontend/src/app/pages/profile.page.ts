import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';
import { INVALID_PHONE_MESSAGE, normalizeArPhone } from '../core/phone';

type FormMessage = { ok: boolean; text: string } | null;

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-md mx-auto flex flex-col gap-6">
        <h1 class="vy-titulo"><span class="vy-marker">Tu</span> <span class="vy-heavy">perfil</span></h1>

        @if (auth.currentUser(); as user) {
          <form class="vy-card p-6 flex flex-col gap-4" (ngSubmit)="saveProfile()">
            <h2 class="vy-marker text-xl">Tus datos</h2>
            <div>
              <p class="vy-label">Email</p>
              <p class="font-bold break-all">{{ user.email }}</p>
            </div>
            <ds-input label="Nombre" [(ngModel)]="fullName" name="fullName" />
            <ds-input label="Celular" type="tel" placeholder="341 555-1234" hint="Con código de área, sin 0 ni 15" [(ngModel)]="phone" name="phone" />

            @if (profileMessage(); as msg) {
              <p class="text-sm" [class.text-success]="msg.ok" [class.text-error]="!msg.ok">{{ msg.text }}</p>
            }
            <button type="submit" class="vy-btn vy-btn--chico self-start" [disabled]="savingProfile()">
              @if (savingProfile()) { <span class="vy-btn-cargando"></span> }
              Guardar cambios
            </button>
          </form>

          <form class="vy-card p-6 flex flex-col gap-4" (ngSubmit)="savePassword()">
            <h2 class="vy-marker text-xl">Cambiar contraseña</h2>
            <ds-input label="Contraseña actual" type="password" [(ngModel)]="currentPassword" name="currentPassword" />
            <ds-input label="Contraseña nueva" type="password" hint="Mínimo 8 caracteres" [(ngModel)]="newPassword" name="newPassword" />
            <ds-input label="Repetir contraseña nueva" type="password" [(ngModel)]="confirmPassword" name="confirmPassword" />

            @if (passwordMessage(); as msg) {
              <p class="text-sm" [class.text-success]="msg.ok" [class.text-error]="!msg.ok">{{ msg.text }}</p>
            }
            <button type="submit" class="vy-btn vy-btn--chico self-start" [disabled]="savingPassword()">
              @if (savingPassword()) { <span class="vy-btn-cargando"></span> }
              Cambiar contraseña
            </button>
          </form>

          <div class="flex flex-wrap gap-3">
            <a routerLink="/mis-pedidos" class="vy-btn">Mis pedidos</a>
            <button type="button" class="vy-btn vy-btn--secundario" (click)="logout()">Cerrar sesión</button>
          </div>
        }
      </div>
    </main>
  `,
})
export class ProfilePage {
  auth = inject(AuthService);
  private router = inject(Router);

  private user = this.auth.currentUser();
  // `name` cae en el email si la cuenta no tiene nombre cargado.
  fullName = this.user && this.user.name !== this.user.email ? this.user.name : '';
  phone = this.user?.phone ?? '';
  profileMessage = signal<FormMessage>(null);
  savingProfile = signal(false);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordMessage = signal<FormMessage>(null);
  savingPassword = signal(false);

  async saveProfile(): Promise<void> {
    this.profileMessage.set(null);
    const phone = normalizeArPhone(this.phone);
    if (!phone) {
      this.profileMessage.set({ ok: false, text: INVALID_PHONE_MESSAGE });
      return;
    }
    this.savingProfile.set(true);
    const error = await this.auth.updateProfile({ fullName: this.fullName.trim(), phone });
    this.savingProfile.set(false);
    this.profileMessage.set(error ? { ok: false, text: error } : { ok: true, text: 'Listo, guardamos tus datos.' });
  }

  async savePassword(): Promise<void> {
    this.passwordMessage.set(null);
    if (this.newPassword.length < 8) {
      this.passwordMessage.set({ ok: false, text: 'La contraseña nueva debe tener al menos 8 caracteres.' });
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordMessage.set({ ok: false, text: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    this.savingPassword.set(true);
    const error = await this.auth.changePassword(this.currentPassword, this.newPassword);
    this.savingPassword.set(false);
    if (error) {
      this.passwordMessage.set({ ok: false, text: error });
      return;
    }
    this.currentPassword = this.newPassword = this.confirmPassword = '';
    this.passwordMessage.set({ ok: true, text: 'Contraseña cambiada. Cerramos tus otras sesiones.' });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
