import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SELLER, STORE_NAME } from '../core/config/app.config.constants';

// Texto modelo: revisarlo con un abogado o contador antes de abrir al
// público (envíos, medios de pago y plazos dependen de cómo opere la tienda).
@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="vy-container py-10">
      <article class="max-w-3xl mx-auto vy-legal">
        <h1 class="vy-titulo"><span class="vy-marker">Términos y</span> <span class="vy-heavy">condiciones</span></h1>
        <p>
          Estos términos regulan las compras en {{ store }}, operada por <strong>{{ seller.legalName }}</strong>
          (CUIT {{ seller.cuit }}), con domicilio en {{ seller.address }}. Al hacer un pedido aceptás estas condiciones.
        </p>

        <h2>Pedidos y precios</h2>
        <p>
          Los precios son finales y están expresados en pesos argentinos. Al confirmar un pedido descontamos el
          stock y te mandamos un mail con el detalle. El pedido queda firme cuando coordinamos con vos el pago y la
          entrega. Si un producto se agotó o hubo un error evidente de precio, te avisamos y podés cancelar sin costo.
        </p>

        <h2>Medios de pago</h2>
        <p>
          Por ahora no cobramos en la web: el pago se coordina por WhatsApp o mail después de confirmar el pedido,
          con los medios que te informemos en ese momento.
        </p>

        <h2>Envíos</h2>
        <p>
          Hacemos envíos dentro de Rosario. El costo y el plazo de entrega se acuerdan al coordinar el pedido.
          Revisá el producto al recibirlo y avisanos de cualquier problema.
        </p>

        <h2>Derecho de arrepentimiento</h2>
        <p>
          Podés revocar la compra dentro de los 10 días corridos desde que recibiste el producto, sin costo y sin
          dar explicaciones (Ley 24.240, art. 34). Hacelo desde el
          <a routerLink="/arrepentimiento">botón de arrepentimiento</a>: te damos un código de trámite al instante.
          El producto tiene que volver sin uso y en su empaque; te devolvemos el total pagado.
        </p>

        <h2>Cambios y garantía</h2>
        <p>
          Si el producto llegó fallado o no es lo que pediste, escribinos apenas lo recibas y lo cambiamos.
          Los productos nuevos tienen la garantía legal de la Ley 24.240 (6 meses para cosas muebles nuevas).
        </p>

        <h2>Contacto</h2>
        <p>
          Por cualquier consulta o reclamo escribinos a {{ seller.email }}. Como consumidor también podés
          hacer un reclamo ante Defensa del Consumidor (Ventanilla Única Federal, argentina.gob.ar/produccion/consumidor).
        </p>
      </article>
    </main>
  `,
})
export class TermsPage {
  store = STORE_NAME;
  seller = SELLER;
}
