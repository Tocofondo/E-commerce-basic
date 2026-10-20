import { Component } from '@angular/core';
import { SELLER, STORE_NAME } from '../core/config/app.config.constants';

// Política de privacidad (Ley 25.326 de Protección de Datos Personales).
// Texto modelo: revisarlo con un abogado antes de abrir al público.
@Component({
  selector: 'app-privacy-page',
  standalone: true,
  template: `
    <main class="vy-container py-10">
      <article class="max-w-3xl mx-auto vy-legal">
        <h1 class="vy-titulo"><span class="vy-marker">Política de</span> <span class="vy-heavy">privacidad</span></h1>
        <p>
          El responsable de tus datos es <strong>{{ seller.legalName }}</strong> (CUIT {{ seller.cuit }}),
          {{ seller.address }}, titular de {{ store }}.
        </p>

        <h2>Qué datos guardamos</h2>
        <ul>
          <li>De tu cuenta: nombre, email, celular y una versión cifrada de tu contraseña (nunca la vemos).</li>
          <li>De cada pedido: los productos, el nombre, el celular y la dirección de envío.</li>
          <li>Si usás el botón de arrepentimiento: los datos que cargues en el formulario.</li>
        </ul>

        <h2>Para qué los usamos</h2>
        <p>
          Solo para gestionar tus pedidos: confirmarlos, coordinar el pago y la entrega, avisarte cambios y
          atender reclamos. No vendemos ni cedemos tus datos a terceros. Te mandamos mails únicamente sobre tus
          pedidos y tu cuenta.
        </p>

        <h2>En tu navegador</h2>
        <p>
          Guardamos en tu navegador (localStorage) el carrito y tu sesión iniciada. No usamos cookies de
          publicidad ni herramientas de seguimiento.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Podés pedir acceso, corrección o eliminación de tus datos escribiendo a {{ seller.email }}. El nombre y
          el celular los podés editar vos desde tu perfil. Respondemos los pedidos de acceso dentro de los 10 días
          corridos y los de corrección o eliminación dentro de los 5 días hábiles (Ley 25.326, arts. 14 y 16).
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias
          y reclamos de quienes vean afectados sus derechos por el incumplimiento de las normas de protección de
          datos personales.
        </p>
      </article>
    </main>
  `,
})
export class PrivacyPage {
  store = STORE_NAME;
  seller = SELLER;
}
