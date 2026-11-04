import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';
import { INVALID_PHONE_MESSAGE, normalizeArPhone } from '../core/phone';
import { PromotionService } from '../core/services/promotion.service';
import { MyCoupon, ReferralStats } from '../core/models/promotion.model';
import { DatePipe } from '@angular/common';

type FormMessage = { ok: boolean; text: string } | null;

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput, DatePipe],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-md mx-auto flex flex-col gap-6">
        <h1 class="vy-titulo"><span class="vy-marker">Tu</span> <span class="vy-heavy">perfil</span></h1>

        @if (auth.currentUser(); as user) {
          @if (referrals(); as ref) {
            <!-- Programa de referidos (ver backend/app/modules/promotions). -->
            <section class="vy-card p-6 flex flex-col gap-3">
              <h2 class="vy-marker text-xl">Invitá y ganá {{ ref.rewardPercent }}%</h2>
              <p class="text-sm vy-muted">
                Compartí tu link. Cuando alguien se registra con él y recibe su primer pedido,
                te ganás un {{ ref.rewardPercent }}% de descuento para tu próxima compra.
              </p>
              <div class="flex gap-2">
                <input class="vy-input flex-1 min-w-0" [value]="inviteLink(ref.code)" readonly aria-label="Tu link de invitación" (focus)="$any($event.target).select()" />
                <button type="button" class="vy-btn vy-btn--secundario vy-btn--chico" (click)="copyInvite(ref.code)">
                  {{ copied() ? '¡Copiado!' : 'Copiar' }}
                </button>
              </div>
              <a [href]="shareLink(ref.code)" target="_blank" rel="noopener" class="vy-btn vy-btn--chico self-start">Compartir por WhatsApp</a>
              <p class="text-sm vy-muted">
                Invitaste a {{ ref.invited }} {{ ref.invited === 1 ? 'persona' : 'personas' }}
                @if (ref.rewarded) { · ganaste {{ ref.rewarded }} {{ ref.rewarded === 1 ? 'cupón' : 'cupones' }} }
              </p>
            </section>
          }

          @if (coupons().length) {
            <section class="vy-card p-6 flex flex-col gap-3">
              <h2 class="vy-marker text-xl">Tus cupones</h2>
              @for (c of coupons(); track c.code) {
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span><strong>{{ c.code }}</strong> · {{ c.percent }}% off</span>
                  @if (c.expiresAt) { <span class="vy-muted">vence {{ c.expiresAt | date: 'dd/MM/yyyy' }}</span> }
                </div>
              }
              <p class="text-xs vy-muted">Se aplican en el checkout, ingresando con esta cuenta.</p>
            </section>
          }

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

  private promotions = inject(PromotionService);
  referrals = signal<ReferralStats | null>(null);
  coupons = signal<MyCoupon[]>([]);
  copied = signal(false);

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

  constructor() {
    // Si falla, la sección simplemente no aparece.
    this.promotions.myReferrals().then(r => this.referrals.set(r)).catch(() => {});
    this.promotions.myCoupons().then(c => this.coupons.set(c)).catch(() => {});
  }

  /** Link de registro con el código (lo lee register.page.ts). */
  inviteLink(code: string): string {
    // Relativo al <base href>: funciona aunque la app no esté en la raíz.
    return new URL(`register?ref=${code}`, document.baseURI).href;
  }

  shareLink(code: string): string {
    const text = `Te invito a VACONYAPA: bueno, barato y con yapa. Registrate con mi link: ${this.inviteLink(code)}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  async copyInvite(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.inviteLink(code));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el input queda seleccionable a mano.
    }
  }

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
