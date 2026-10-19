import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VyLogoComponent } from './vy-logo.component';
import { VyYapaComponent } from './vy-yapa.component';
import { VyProductCardComponent, VyProducto } from './vy-product-card.component';

/**
 * Página de muestra para ver toda la marca junta.
 * Agregala a tus rutas para probar:  { path: 'marca', component: BrandDemoComponent }
 * Los productos son de ejemplo: reemplazalos por los reales.
 */
@Component({
  selector: 'vy-brand-demo',
  standalone: true,
  imports: [VyLogoComponent, VyYapaComponent, VyProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'vy-oscuro' },
  template: `
    <header class="barra">
      <div class="vy-container barra-in">
        <vy-logo alto="34px" />
        <nav class="menu" aria-label="Principal">
          <a href="#productos">Productos</a>
          <a href="#como-compro">Cómo compro</a>
          <a class="vy-btn vy-btn--secundario" href="#contacto">Escribinos</a>
        </nav>
      </div>
    </header>

    <section class="portada vy-container">
      <vy-yapa [tamano]="72" />
      <h1 class="titulo">
        <span class="vy-marker">Bueno, barato</span><br />
        <span class="vy-heavy">y con yapa</span>
      </h1>
      <p class="vy-marker vy-subrayado bajada">Llegó a Rosario</p>
      <div class="acciones">
        <a class="vy-btn" href="#productos">Ver productos</a>
        <a class="vy-btn vy-btn--marcador" href="#contacto">Pedí por WhatsApp</a>
      </div>
      <ul class="beneficios">
        <li><span class="vy-label">Envíos</span><span class="vy-heavy">al toque</span></li>
        <li><span class="vy-label">En cada pedido</span><span class="vy-heavy">un regalo</span></li>
        <li><span class="vy-label">Pagás</span><span class="vy-heavy">como quieras</span></li>
      </ul>
    </section>

    <section id="productos" class="vy-container seccion">
      <h2 class="seccion-titulo"><span class="vy-marker">Lo más</span> <span class="vy-heavy">pedido</span></h2>
      <div class="grilla">
        @for (p of productos; track p.id) {
          <vy-product-card [producto]="p" (agregar)="agregar($event)" />
        }
      </div>
    </section>

    <footer class="pie">
      <div class="vy-container pie-in">
        <vy-logo variante="icono" alto="40px" />
        <span class="vy-muted">Rosario, Santa Fe</span>
      </div>
    </footer>
  `,
  styles: [
    `
      :host { display: block; min-height: 100vh; }
      .barra { position: sticky; top: 0; z-index: 10; background: var(--vy-negro); border-bottom: 1px solid var(--vy-borde); }
      .barra-in { display: flex; align-items: center; justify-content: space-between; gap: var(--vy-space-4); min-height: 72px; flex-wrap: wrap; }
      .menu { display: flex; align-items: center; gap: var(--vy-space-5); flex-wrap: wrap; }
      .menu a:not(.vy-btn) { color: var(--vy-blanco); text-decoration: none; font-weight: 600; }
      .menu a:not(.vy-btn):hover { color: var(--vy-verde); }

      .portada { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--vy-space-5); padding-block: var(--vy-space-8); }
      .titulo { font-size: var(--vy-fs-3xl); line-height: 1; }
      .bajada { font-size: var(--vy-fs-xl); }
      .acciones { display: flex; gap: var(--vy-space-3); flex-wrap: wrap; justify-content: center; }
      .beneficios { list-style: none; margin: var(--vy-space-5) 0 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: var(--vy-space-6); }
      .beneficios li { display: flex; flex-direction: column; gap: var(--vy-space-1); }
      .beneficios .vy-heavy { font-size: var(--vy-fs-lg); }

      .seccion { padding-block: var(--vy-space-7); display: flex; flex-direction: column; gap: var(--vy-space-5); }
      .seccion-titulo { font-size: var(--vy-fs-2xl); }
      .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: var(--vy-space-5); }

      .pie { border-top: 1px solid var(--vy-borde); margin-top: var(--vy-space-7); }
      .pie-in { display: flex; align-items: center; justify-content: space-between; min-height: 96px; }
    `,
  ],
})
export class BrandDemoComponent {
  productos: VyProducto[] = [
    { id: 'ejemplo-1', nombre: 'Botella térmica 750 ml', precio: 0, conYapa: true },
    { id: 'ejemplo-2', nombre: 'Auriculares inalámbricos', precio: 0, conYapa: true },
    { id: 'ejemplo-3', nombre: 'Vaso térmico con tapa', precio: 0 },
    { id: 'ejemplo-4', nombre: 'Parlante bluetooth', precio: 0, conYapa: true },
  ];

  agregar(p: VyProducto): void {
    console.log('Agregar al carrito', p.id);
  }
}
