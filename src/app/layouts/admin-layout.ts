import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DsButton } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DsButton],
  template: `
    <div class="min-h-screen flex bg-neutral-50">
      <aside class="w-56 shrink-0 bg-surface border-r border-border flex flex-col">
        <div class="h-16 flex items-center px-5 border-b border-border">
          <span class="font-bold text-brand-600">Admin</span>
        </div>
        <nav class="flex flex-col gap-1 p-3 flex-1">
          <a routerLink="/admin" routerLinkActive="bg-brand-50 text-brand-700" [routerLinkActiveOptions]="{ exact: true }"
             class="px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
            Dashboard
          </a>
          <a routerLink="/admin/productos" routerLinkActive="bg-brand-50 text-brand-700"
             class="px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
            Productos
          </a>
          <a routerLink="/admin/pedidos" routerLinkActive="bg-brand-50 text-brand-700"
             class="px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
            Pedidos
          </a>
        </nav>
        <div class="p-3 border-t border-border flex flex-col gap-2">
          <span class="text-xs text-neutral-500 px-1">{{ auth.currentUser()?.name }}</span>
          <ds-button variant="ghost" size="sm" (clicked)="logout()">Salir</ds-button>
        </div>
      </aside>

      <main class="flex-1 p-6 sm:p-8">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminLayout {
  auth = inject(AuthService);
  router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
