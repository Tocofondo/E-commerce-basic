import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { DsNavbar, DsFooter, NavLink, FooterColumn } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';
import { CartService } from '../core/services/cart.service';

@Component({
  selector: 'app-store-layout',
  standalone: true,
  imports: [RouterOutlet, DsNavbar, DsFooter],
  template: `
    <ds-navbar
      brandName="Mi Tienda"
      [links]="navLinks"
      [cartCount]="cart.count()"
      (cartClicked)="router.navigate(['/carrito'])"
      (searchClicked)="router.navigate(['/productos'])"
      (loginClicked)="onLoginClick()"
    />

    <router-outlet />

    <ds-footer
      brandName="Mi Tienda"
      tagline="Tu tienda online de confianza para productos de calidad."
      [columns]="footerColumns"
      [socials]="[
        { label: 'Instagram', href: '#' },
        { label: 'Twitter', href: '#' },
        { label: 'Facebook', href: '#' }
      ]"
    />
  `,
})
export class StoreLayout {
  auth = inject(AuthService);
  cart = inject(CartService);
  router = inject(Router);

  navLinks: NavLink[] = [
    { label: 'Inicio', href: '/' },
    { label: 'Productos', href: '/productos' },
    { label: 'Mis pedidos', href: '/mis-pedidos' },
    { label: 'Perfil', href: '/perfil' },
  ];

  footerColumns: FooterColumn[] = [
    {
      title: 'Tienda',
      links: [
        { label: 'Productos', href: '/productos' },
        { label: 'Ofertas', href: '/productos' },
      ],
    },
    {
      title: 'Ayuda',
      links: [
        { label: 'Mis pedidos', href: '/mis-pedidos' },
        { label: 'Perfil', href: '/perfil' },
      ],
    },
    {
      title: 'Empresa',
      links: [
        { label: 'Nosotros', href: '#' },
        { label: 'Contacto', href: '#' },
      ],
    },
  ];

  onLoginClick(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
