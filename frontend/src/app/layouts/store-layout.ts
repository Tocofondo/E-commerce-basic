import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { CartService } from '../core/services/cart.service';
import { VyLogoComponent } from '../shared/brand/vy-logo.component';

interface StoreLink {
  label: string;
  href: string;
}

// Barra y pie propios (no ds-navbar/ds-footer): la tienda va sobre el negro
// de la marca y el design-system está pensado para fondo claro. `vy-tienda`
// re-mapea los tokens para lo que sí se sigue usando del design-system
// (ds-input, ds-spinner) — ver src/brand.scss.
@Component({
  selector: 'app-store-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, VyLogoComponent],
  host: { class: 'vy-oscuro vy-tienda' },
  template: `
    <header class="barra">
      <div class="vy-container barra-in">
        <a routerLink="/" class="logo" aria-label="VACONYAPA, ir al inicio">
          <vy-logo alto="30px" />
        </a>

        <nav class="menu menu--escritorio" aria-label="Principal">
          @for (link of navLinks; track link.href) {
            <a
              [routerLink]="link.href"
              routerLinkActive="activo"
              [routerLinkActiveOptions]="{ exact: link.href === '/' }"
            >{{ link.label }}</a>
          }
        </nav>

        <div class="acciones">
          <a routerLink="/carrito" class="icono" aria-label="Carrito">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            @if (cart.count() > 0) {
              <span class="contador">{{ cart.count() > 9 ? '9+' : cart.count() }}</span>
            }
          </a>
          <!-- En el celu no entra el botón con el nombre: queda solo el ícono. -->
          <button type="button" class="icono cuenta-icono" [attr.aria-label]="auth.currentUser()?.name ?? 'Ingresar'" (click)="onAccountClick()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          <button type="button" class="vy-btn vy-btn--secundario vy-btn--chico cuenta" (click)="onAccountClick()">
            {{ auth.currentUser()?.name ?? 'Ingresar' }}
          </button>
        </div>
      </div>

      <nav class="menu menu--celu vy-container" aria-label="Principal">
        @for (link of navLinks; track link.href) {
          <a
            [routerLink]="link.href"
            routerLinkActive="activo"
            [routerLinkActiveOptions]="{ exact: link.href === '/' }"
          >{{ link.label }}</a>
        }
      </nav>
    </header>

    <div class="contenido">
      <router-outlet />
    </div>

    <footer class="pie">
      <div class="vy-container pie-in">
        <div class="pie-marca">
          <vy-logo alto="34px" />
          <p class="vy-muted">Bueno, barato y con yapa. Envíos a todo Rosario.</p>
        </div>

        @for (col of footerColumns; track col.title) {
          <div class="pie-columna">
            <span class="vy-label">{{ col.title }}</span>
            @for (link of col.links; track link.label) {
              <a [routerLink]="link.href">{{ link.label }}</a>
            }
          </div>
        }
      </div>
      <div class="vy-container pie-base">
        <span class="vy-label">Rosario, Santa Fe · © {{ year }} VACONYAPA</span>
      </div>
    </footer>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; min-height: 100vh; }
      .contenido { flex: 1; }

      .barra {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(16, 18, 16, 0.92);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--vy-borde);
      }
      .barra-in { display: flex; align-items: center; justify-content: space-between; gap: var(--vy-space-4); min-height: 68px; }
      .logo { display: inline-flex; flex-shrink: 0; }

      .menu { display: flex; align-items: center; gap: var(--vy-space-1); }
      .menu a {
        padding: var(--vy-space-2) var(--vy-space-3);
        border-radius: var(--vy-radius-pill);
        color: var(--vy-texto-suave);
        font-weight: 700;
        font-size: var(--vy-fs-sm);
        text-decoration: none;
        white-space: nowrap;
      }
      .menu a:hover { color: var(--vy-blanco); }
      .menu a.activo { color: var(--vy-verde); }
      .menu--escritorio { display: none; }
      .menu--celu { overflow-x: auto; padding-bottom: var(--vy-space-2); scrollbar-width: none; }
      @media (min-width: 768px) {
        .menu--escritorio { display: flex; }
        .menu--celu { display: none; }
      }

      .acciones { display: flex; align-items: center; gap: var(--vy-space-2); }
      .icono {
        position: relative;
        display: inline-flex;
        padding: var(--vy-space-2);
        color: var(--vy-blanco);
      }
      .icono:hover { color: var(--vy-verde); }
      .icono svg { width: 24px; height: 24px; }
      .contador {
        position: absolute;
        top: 0;
        right: -2px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: var(--vy-radius-pill);
        background: var(--vy-verde);
        color: var(--vy-negro);
        font-size: 11px;
        font-weight: 900;
        line-height: 18px;
        text-align: center;
      }
      .icono { cursor: pointer; }
      .cuenta { display: none; }
      @media (min-width: 520px) {
        .cuenta-icono { display: none; }
        .cuenta { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; line-height: 36px; }
      }

      .pie { border-top: 1px solid var(--vy-borde); margin-top: var(--vy-space-8); }
      .pie-in {
        display: grid;
        gap: var(--vy-space-6);
        padding-block: var(--vy-space-7);
        grid-template-columns: 1fr 1fr;
      }
      .pie-marca { grid-column: 1 / -1; display: flex; flex-direction: column; gap: var(--vy-space-3); }
      @media (min-width: 768px) {
        .pie-in { grid-template-columns: 2fr 1fr 1fr; }
        .pie-marca { grid-column: auto; }
      }
      .pie-columna { display: flex; flex-direction: column; gap: var(--vy-space-2); }
      .pie-columna a { color: var(--vy-texto-suave); text-decoration: none; font-size: var(--vy-fs-sm); }
      .pie-columna a:hover { color: var(--vy-verde); }
      .pie-base { border-top: 1px solid var(--vy-borde); padding-block: var(--vy-space-4); }
    `,
  ],
})
export class StoreLayout {
  auth = inject(AuthService);
  cart = inject(CartService);
  router = inject(Router);

  year = new Date().getFullYear();

  navLinks: StoreLink[] = [
    { label: 'Inicio', href: '/' },
    { label: 'Productos', href: '/productos' },
    { label: 'Mis pedidos', href: '/mis-pedidos' },
    { label: 'Perfil', href: '/perfil' },
  ];

  footerColumns: { title: string; links: StoreLink[] }[] = [
    {
      title: 'Tienda',
      links: [
        { label: 'Productos', href: '/productos' },
        { label: 'Carrito', href: '/carrito' },
      ],
    },
    {
      title: 'Tu cuenta',
      links: [
        { label: 'Mis pedidos', href: '/mis-pedidos' },
        { label: 'Perfil', href: '/perfil' },
      ],
    },
  ];

  onAccountClick(): void {
    this.router.navigate([this.auth.isLoggedIn() ? '/perfil' : '/login']);
  }
}
