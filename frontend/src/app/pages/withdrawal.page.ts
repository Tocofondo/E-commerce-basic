import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DsInput } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';
import { WithdrawalService } from '../core/services/withdrawal.service';
import { WithdrawalInput } from '../core/models/withdrawal.model';
import { apiErrorMessage } from '../core/http-error';
import { INVALID_PHONE_MESSAGE, normalizeArPhone } from '../core/phone';

// Botón de arrepentimiento (Res. 424/2020 SCI): revocar una compra dentro de
// los 10 días, sin necesidad de tener cuenta, con un código de trámite como
// constancia. Se llega desde el pie de todas las páginas de la tienda.
@Component({
  selector: 'app-withdrawal-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsInput],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-xl mx-auto flex flex-col gap-6">
        <h1 class="vy-titulo"><span class="vy-marker">Botón de</span> <span class="vy-heavy">arrepentimiento</span></h1>

        @if (code(); as code) {
          <div class="vy-card p-6 flex flex-col gap-4 text-center items-center">
            <span class="vy-label">Tu código de trámite</span>
            <span class="vy-heavy text-3xl select-all">{{ code }}</span>
            <p class="vy-muted">
              Guardalo: es la constancia de tu pedido. También te lo mandamos por mail.
              Te vamos a contactar para coordinar la devolución.
            </p>
            <a routerLink="/" class="vy-btn">Volver a la tienda</a>
          </div>
        } @else {
          <p class="vy-muted">
            Si compraste y te arrepentiste, podés revocar la compra dentro de los
            <strong class="text-neutral-900">10 días corridos</strong> desde que la recibiste, sin dar
            explicaciones y sin costo (Ley 24.240, art. 34). Completá el formulario y te damos un código
            de trámite al instante.
          </p>

          <form class="vy-card p-5 sm:p-6 flex flex-col gap-4" (ngSubmit)="onSubmit()">
            <ds-input label="Nombre y apellido" [required]="true" [(ngModel)]="form.fullName" name="fullName" />
            <ds-input label="Email" type="email" [required]="true" [(ngModel)]="form.email" name="email" />
            <ds-input label="Celular" type="tel" placeholder="341 555-1234" [required]="true" [(ngModel)]="form.phone" name="phone" />
            <ds-input label="Número de pedido" placeholder="Ej. 128" [required]="true" [(ngModel)]="form.orderNumber" name="orderNumber" />
            <label class="flex flex-col gap-1">
              <span class="text-sm font-medium text-neutral-700">Motivo (opcional)</span>
              <textarea class="vy-input py-3 min-h-28" maxlength="2000" [(ngModel)]="form.reason" name="reason"></textarea>
            </label>

            @if (error()) {
              <p class="text-sm text-error">{{ error() }}</p>
            }

            <button type="submit" class="vy-btn vy-btn--bloque" [disabled]="loading()">
              @if (loading()) { <span class="vy-btn-cargando"></span> }
              Pedir la revocación
            </button>
          </form>
        }
      </div>
    </main>
  `,
})
export class WithdrawalPage {
  private withdrawals = inject(WithdrawalService);
  private user = inject(AuthService).currentUser();

  form: WithdrawalInput = {
    fullName: this.user && this.user.name !== this.user.email ? this.user.name : '',
    email: this.user?.email ?? '',
    phone: this.user?.phone ?? '',
    orderNumber: '',
    reason: '',
  };
  code = signal('');
  error = signal('');
  loading = signal(false);

  async onSubmit(): Promise<void> {
    this.error.set('');
    if (!this.form.fullName.trim() || !this.form.email.trim() || !this.form.orderNumber.trim()) {
      this.error.set('Completá nombre, email y número de pedido.');
      return;
    }
    const phone = normalizeArPhone(this.form.phone);
    if (!phone) {
      this.error.set(INVALID_PHONE_MESSAGE);
      return;
    }

    this.loading.set(true);
    try {
      this.code.set(await this.withdrawals.create({ ...this.form, phone }));
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudo enviar el pedido. Probá de nuevo.'));
    } finally {
      this.loading.set(false);
    }
  }
}
