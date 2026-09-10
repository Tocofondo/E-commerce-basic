import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DsButton } from '../design-system/index';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [DsButton],
  template: `
    <main class="max-w-md mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">Perfil</h1>

      @if (auth.currentUser(); as user) {
        <div class="bg-surface border border-border rounded-xl p-6 flex flex-col gap-3">
          <div>
            <p class="text-xs text-neutral-500">Nombre</p>
            <p class="text-neutral-800 font-medium">{{ user.name }}</p>
          </div>
          <div>
            <p class="text-xs text-neutral-500">Email</p>
            <p class="text-neutral-800 font-medium">{{ user.email }}</p>
          </div>
          <div>
            <p class="text-xs text-neutral-500">Rol</p>
            <p class="text-neutral-800 font-medium capitalize">{{ user.role }}</p>
          </div>
        </div>

        <ds-button variant="ghost" (clicked)="logout()">Cerrar sesión</ds-button>
      }
    </main>
  `,
})
export class ProfilePage {
  auth = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
