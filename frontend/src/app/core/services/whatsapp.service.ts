import { Injectable } from '@angular/core';
import { Order } from '../models/order.model';
import { ADMIN_WHATSAPP } from '../config/app.config.constants';
import { normalizeArPhone } from '../phone';
import { formatPesos } from '../../shared/store/pesos.pipe';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  /** `false` mientras ADMIN_WHATSAPP siga con el placeholder: el checkout no
   * muestra un botón que abriría un chat con un número inexistente. */
  readonly adminConfigured = /^549\d{10}$/.test(ADMIN_WHATSAPP);

  buildOrderMessage(order: Order): string {
    const lines = [
      `Nuevo pedido #${order.id}`,
      ...order.items.map(i => `- ${i.qty}x ${i.product.name} (${formatPesos(i.product.price)})`),
      `Total: ${formatPesos(order.total)}`,
      '',
      `Cliente: ${order.shipping.fullName}`,
      `Dirección: ${order.shipping.address}, ${order.shipping.city} (${order.shipping.postalCode})`,
    ];
    return lines.join('\n');
  }

  buildOrderLink(order: Order): string {
    const message = encodeURIComponent(this.buildOrderMessage(order));
    return `https://wa.me/${ADMIN_WHATSAPP}?text=${message}`;
  }

  /** Link para escribirle al cliente, o `null` si el teléfono que cargó no se
   * puede pasar a formato internacional (pedidos anteriores a la validación). */
  buildCustomerLink(order: Order): string | null {
    const phone = normalizeArPhone(order.shipping.phone);
    if (!phone) return null;
    const message = encodeURIComponent(`Hola ${order.shipping.fullName}, te contactamos por tu pedido #${order.id}.`);
    return `https://wa.me/${phone}?text=${message}`;
  }
}
