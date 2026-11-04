import { CartItem } from './cart.model';

export type OrderStatus = 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';

export interface ShippingInfo {
  fullName: string;
  /** Opcional: alcanza con email o teléfono. */
  phone: string | null;
  address: string;
  city: string;
  postalCode: string;
}

export interface Order {
  id: number;
  /** `null` = compra como invitado. */
  userId: string | null;
  /** Email de contacto: el de la cuenta, o el que dejó el invitado. */
  customerEmail: string | null;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  shipping: ShippingInfo;
}
