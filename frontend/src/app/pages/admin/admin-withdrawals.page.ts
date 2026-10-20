import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DsBadge, DsButton, DsSpinner } from '../../design-system/index';
import { WithdrawalService } from '../../core/services/withdrawal.service';
import { Withdrawal } from '../../core/models/withdrawal.model';
import { apiErrorMessage } from '../../core/http-error';

@Component({
  selector: 'app-admin-withdrawals-page',
  standalone: true,
  imports: [DatePipe, DsBadge, DsButton, DsSpinner],
  template: `
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">Arrepentimientos</h1>
        <p class="text-sm text-neutral-500 mt-1">
          Pedidos de revocación de compra hechos desde el botón de arrepentimiento de la tienda.
        </p>
      </div>

      @if (actionError()) {
        <p class="text-sm text-error">{{ actionError() }}</p>
      }

      @if (withdrawals.loading()) {
        <div class="py-10 flex justify-center"><ds-spinner size="lg" /></div>
      } @else if (withdrawals.error()) {
        <div class="py-10 flex flex-col items-center gap-4 text-center">
          <p class="text-neutral-500 text-sm">{{ withdrawals.error() }}</p>
          <ds-button variant="primary" (clicked)="withdrawals.loadAll()">Reintentar</ds-button>
        </div>
      } @else if (withdrawals.withdrawals().length === 0) {
        <p class="text-neutral-500 text-sm">No hay pedidos de arrepentimiento.</p>
      } @else {
        <div class="flex flex-col gap-3">
          @for (w of withdrawals.withdrawals(); track w.id) {
            <div class="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div class="flex flex-wrap items-center gap-3">
                <span class="font-bold text-neutral-800">{{ w.code }}</span>
                <span class="text-neutral-500">{{ w.createdAt | date: 'short' }}</span>
                <ds-badge [variant]="w.status === 'pendiente' ? 'featured' : 'new'">{{ w.status }}</ds-badge>
                <span class="ml-auto">
                  <ds-button
                    size="sm"
                    [variant]="w.status === 'pendiente' ? 'primary' : 'ghost'"
                    [loading]="updatingId() === w.id"
                    (clicked)="toggle(w)"
                  >
                    {{ w.status === 'pendiente' ? 'Marcar resuelta' : 'Reabrir' }}
                  </ds-button>
                </span>
              </div>
              <p class="text-neutral-700">
                Pedido <strong>{{ w.orderNumber }}</strong> · {{ w.fullName }} ·
                <a [href]="'mailto:' + w.email" class="text-brand-600 hover:underline">{{ w.email }}</a> ·
                {{ w.phone }}
              </p>
              @if (w.reason) {
                <p class="text-neutral-500 whitespace-pre-line">{{ w.reason }}</p>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminWithdrawalsPage {
  withdrawals = inject(WithdrawalService);

  updatingId = signal<number | null>(null);
  actionError = signal('');

  constructor() {
    this.withdrawals.loadAll();
  }

  async toggle(w: Withdrawal): Promise<void> {
    this.actionError.set('');
    this.updatingId.set(w.id);
    try {
      await this.withdrawals.setStatus(w.id, w.status === 'pendiente' ? 'resuelta' : 'pendiente');
    } catch (err) {
      this.actionError.set(apiErrorMessage(err, `No se pudo actualizar el trámite ${w.code}.`));
    } finally {
      this.updatingId.set(null);
    }
  }
}
