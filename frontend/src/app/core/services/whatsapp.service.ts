import { Injectable } from '@angular/core';
import { Order } from '../models/order.model';
import { ADMIN_WHATSAPP } from '../config/app.config.constants';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  buildOrderMessage(order: Order): string {
    const lines = [
      `Nuevo pedido #${order.id}`,
      ...order.items.map(i => `- ${i.qty}x ${i.product.name} ($${i.product.price.toFixed(2)})`),
      `Total: $${order.total.toFixed(2)}`,
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

  buildCustomerLink(order: Order): string {
    const message = encodeURIComponent(`Hola ${order.shipping.fullName}, te contactamos por tu pedido #${order.id}.`);
    return `https://wa.me/${order.shipping.phone}?text=${message}`;
  }
}
