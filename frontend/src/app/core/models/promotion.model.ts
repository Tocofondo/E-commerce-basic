// Mismo shape que backend/app/modules/promotions/schemas.py.

/** `product`: descuento por producto (alcance + unidades mínimas del mismo
 * producto). `order`: descuento al total desde un monto mínimo. */
export type PromotionKind = 'product' | 'order';

export interface PromotionInput {
  name: string;
  kind: PromotionKind;
  percent: number;
  productId: number | null;
  category: string | null;
  minQty: number;
  minAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export interface Promotion extends PromotionInput {
  id: number;
  productName: string | null;
  createdAt: string;
}

export interface CouponInput {
  code: string;
  percent: number;
  minAmount: number | null;
  /** `null` = sin límite. */
  maxUses: number | null;
  expiresAt: string | null;
  isActive: boolean;
}

export interface Coupon extends CouponInput {
  id: number;
  uses: number;
  /** `referral` = premio del programa de referidos (personal). */
  origin: 'admin' | 'referral';
  ownerEmail: string | null;
  createdAt: string;
}

/** Cupón personal disponible, como lo ve su dueño. */
export interface MyCoupon {
  code: string;
  percent: number;
  minAmount: number | null;
  expiresAt: string | null;
}

export interface ReferralStats {
  code: string;
  invited: number;
  rewarded: number;
  rewardPercent: number;
}

export interface AppliedDiscount {
  label: string;
  amount: number;
}

export interface OrderQuote {
  subtotal: number;
  discounts: AppliedDiscount[];
  discountTotal: number;
  total: number;
  /** El cupón no aplica: el presupuesto vino sin él. */
  couponError: string | null;
}
