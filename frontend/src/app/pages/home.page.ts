import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DsSpinner } from '../design-system/index';
import { ProductService } from '../core/services/product.service';
import { CartService } from '../core/services/cart.service';
import { Product } from '../core/models/product.model';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';
import { StoreProductCard } from '../shared/store/store-product-card';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, DsSpinner, VyLogoComponent, StoreProductCard],
  template: `
    <section class="portada vy-container">
      <vy-logo variante="sello" alto="96px" />
      <h1 class="titulo">
        <span class="vy-marker">Bueno, barato</span><br />
        <span class="vy-heavy">y con yapa</span>
      </h1>
      <p class="vy-marker vy-subrayado bajada">Llegó a Rosario</p>
      <div class="acciones">
        <a class="vy-btn" routerLink="/productos">Ver productos</a>
        <a class="vy-btn vy-btn--secundario" href="#como-compro" (click)="scrollTo($event, 'como-compro')">Cómo compro</a>
      </div>
      <ul class="beneficios">
        <li><span class="vy-label">Envíos</span><span class="vy-heavy">a todo Rosario</span></li>
        <li><span class="vy-label">En cada pedido</span><span class="vy-heavy">un regalo</span></li>
        <li><span class="vy-label">Pedís</span><span class="vy-heavy">desde el celu</span></li>
      </ul>
    </section>

    <section class="vy-container seccion">
      <div class="seccion-cabecera">
        <h2 class="vy-titulo"><span class="vy-marker">Lo más</span> <span class="vy-heavy">pedido</span></h2>
        <a routerLink="/productos" class="ver-todo">Ver todo &rarr;</a>
      </div>

      @if (products.error() && !products.loaded()) {
        <div class="estado">
          <p class="vy-muted">{{ products.error() }}</p>
          <button type="button" class="vy-btn" [disabled]="products.loading()" (click)="products.refresh()">
            @if (products.loading()) { <span class="vy-btn-cargando"></span> }
            Reintentar
          </button>
        </div>
      } @else if (!products.loaded()) {
        <div class="estado"><ds-spinner size="lg" /></div>
      } @else {
        <div class="grilla">
          @for (product of featured(); track product.id) {
            <app-store-product-card [product]="product" (addToCart)="onAddToCart($event)" />
          }
        </div>
      }
    </section>

    <section id="como-compro" class="vy-container seccion">
      <h2 class="vy-titulo"><span class="vy-marker">Cómo</span> <span class="vy-heavy">compro</span></h2>
      <ol class="pasos">
        <li class="vy-card paso">
          <span class="vy-heavy numero">1</span>
          <span class="vy-marker paso-titulo">Elegí</span>
          <p class="vy-muted">Sumá al carrito lo que te guste del catálogo.</p>
        </li>
        <li class="vy-card paso">
          <span class="vy-heavy numero">2</span>
          <span class="vy-marker paso-titulo">Confirmá</span>
          <p class="vy-muted">Cargá la dirección de envío y confirmá el pedido.</p>
        </li>
        <li class="vy-card paso">
          <span class="vy-heavy numero">3</span>
          <span class="vy-marker paso-titulo">Mandalo por WhatsApp</span>
          <p class="vy-muted">Nos llega al toque y coordinamos la entrega. Y va con yapa.</p>
        </li>
      </ol>
    </section>
  `,
  styles: [
    `
      :host { display: block; }

      .portada {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--vy-space-5);
        padding-block: var(--vy-space-8) var(--vy-space-7);
      }
      .titulo { font-size: var(--vy-fs-3xl); line-height: 1; }
      .bajada { font-size: var(--vy-fs-xl); }
      .acciones { display: flex; gap: var(--vy-space-3); flex-wrap: wrap; justify-content: center; }
      .beneficios {
        list-style: none;
        margin: var(--vy-space-5) 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--vy-space-6);
      }
      .beneficios li { display: flex; flex-direction: column; gap: var(--vy-space-1); }
      .beneficios .vy-heavy { font-size: var(--vy-fs-lg); }

      .seccion { padding-block: var(--vy-space-7); display: flex; flex-direction: column; gap: var(--vy-space-5); scroll-margin-top: 80px; }
      .seccion-cabecera { display: flex; align-items: baseline; justify-content: space-between; gap: var(--vy-space-4); flex-wrap: wrap; }
      .ver-todo { font-weight: 700; text-decoration: none; }
      .grilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--vy-space-4); }
      @media (min-width: 900px) {
        .grilla { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--vy-space-5); }
      }
      .estado { padding-block: var(--vy-space-7); display: flex; flex-direction: column; align-items: center; gap: var(--vy-space-4); text-align: center; }

      .pasos {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--vy-space-4);
      }
      @media (min-width: 768px) {
        .pasos { grid-template-columns: repeat(3, 1fr); }
      }
      .paso { padding: var(--vy-space-5); display: flex; flex-direction: column; gap: var(--vy-space-2); }
      .numero { font-size: var(--vy-fs-2xl); line-height: 1; }
      .paso-titulo { font-size: var(--vy-fs-lg); }
    `,
  ],
})
export class HomePage {
  products = inject(ProductService);
  private cart = inject(CartService);

  // Primero los que el admin marcó como "Destacado" (badge `featured`),
  // completando con el resto del catálogo hasta 4. Los sin stock, al final.
  featured = computed(() => {
    const list = this.products.products();
    const rank = (p: (typeof list)[number]) =>
      (p.badge?.variant === 'featured' ? 0 : 1) + (p.stock > 0 ? 0 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  });

  onAddToCart(product: Product): void {
    this.cart.add(product);
  }

  // Con <base href> un href="#x" navegaría a la raíz del sitio: scrolleamos a mano.
  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
