import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { apiErrorMessage } from '../http-error';
import { Withdrawal, WithdrawalInput, WithdrawalStatus } from '../models/withdrawal.model';

// Botón de arrepentimiento (backend/app/modules/withdrawals): el alta es
// pública y devuelve el código de trámite; el listado es solo para el admin.
@Injectable({ providedIn: 'root' })
export class WithdrawalService {
  private http = inject(HttpClient);

  withdrawals = signal<Withdrawal[]>([]);
  loading = signal(false);
  error = signal('');

  /** Devuelve el código de trámite. Rechaza con el error HTTP si falla. */
  async create(data: WithdrawalInput): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ code: string }>(`${API_BASE_URL}/withdrawals`, data),
    );
    return res.code;
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.withdrawals.set(await firstValueFrom(this.http.get<Withdrawal[]>(`${API_BASE_URL}/withdrawals`)));
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudieron cargar los pedidos de arrepentimiento.'));
    } finally {
      this.loading.set(false);
    }
  }

  async setStatus(id: number, status: WithdrawalStatus): Promise<void> {
    const updated = await firstValueFrom(
      this.http.patch<Withdrawal>(`${API_BASE_URL}/withdrawals/${id}`, { status }),
    );
    this.withdrawals.update(list => list.map(w => (w.id === id ? updated : w)));
  }
}
