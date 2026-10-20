export type WithdrawalStatus = 'pendiente' | 'resuelta';

/** Lo que carga quien pide revocar una compra (botón de arrepentimiento). */
export interface WithdrawalInput {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  reason: string;
}

export interface Withdrawal extends WithdrawalInput {
  id: number;
  code: string;
  status: WithdrawalStatus;
  createdAt: string;
}
