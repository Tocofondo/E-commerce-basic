import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DsButton } from '../button/ds-button';

export interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

@Component({
  selector: 'ds-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, DsButton],
  template: `
    <header class="bg-surface border-b border-border sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between h-16">

          <!-- Logo -->
          <a routerLink="/" class="flex items-center gap-2 text-brand-600 font-bold text-xl">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>{{ brandName }}</span>
          </a>

          <!-- Nav links — desktop -->
          <nav class="hidden md:flex items-center gap-1">
            @for (link of links; track link.href) {
              <a
                [routerLink]="link.href"
                [class]="link.active
                  ? 'px-3 py-2 rounded-lg text-sm font-medium text-brand-600 bg-brand-50'
                  : 'px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors'"
              >
                {{ link.label }}
              </a>
            }
          </nav>

          <!-- Acciones -->
          <div class="flex items-center gap-2">
            <!-- Buscador -->
            <button
              (click)="searchClicked.emit()"
              class="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              aria-label="Buscar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <!-- Carrito -->
            <button
              (click)="cartClicked.emit()"
              class="relative p-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              aria-label="Carrito"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              @if (cartCount > 0) {
                <span class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {{ cartCount > 9 ? '9+' : cartCount }}
                </span>
              }
            </button>

            <!-- CTA login -->
            <div class="hidden sm:block ml-1">
              <ds-button size="sm" variant="secondary" (clicked)="loginClicked.emit()">
                Ingresar
              </ds-button>
            </div>
          </div>

        </div>
      </div>
    </header>
  `,
})
export class DsNavbar {
  @Input() brandName = 'Mi Tienda';
  @Input() links: NavLink[] = [];
  @Input() cartCount = 0;
  @Output() cartClicked = new EventEmitter<void>();
  @Output() searchClicked = new EventEmitter<void>();
  @Output() loginClicked = new EventEmitter<void>();
}
