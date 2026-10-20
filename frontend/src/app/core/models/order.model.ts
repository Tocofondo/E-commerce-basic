import { CartItem } from './cart.model';

export type OrderStatus = 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';

export interface ShippingInfo {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface Order {
  id: number;
  userId: string;
  /** Email de la cuenta que hizo el pedido (para el admin). */
  customerEmail: string | null;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  shipping: ShippingInfo;
}
