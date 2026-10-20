import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="vy-container py-10">
      <div class="max-w-md mx-auto flex flex-col gap-6">
        <h1 class="vy-titulo"><span class="vy-marker">Tu</span> <span class="vy-heavy">perfil</span></h1>

        @if (auth.currentUser(); as user) {
          <div class="vy-card p-6 flex flex-col gap-4">
            <div>
              <p class="vy-label">Nombre</p>
              <p class="font-bold">{{ user.name }}</p>
            </div>
            <div>
              <p class="vy-label">Email</p>
              <p class="font-bold break-all">{{ user.email }}</p>
            </div>
            @if (user.phone) {
              <div>
                <p class="vy-label">Teléfono</p>
                <p class="font-bold">{{ user.phone }}</p>
              </div>
            }
          </div>

          <div class="flex flex-wrap gap-3">
            <a routerLink="/mis-pedidos" class="vy-btn">Mis pedidos</a>
            <button type="button" class="vy-btn vy-btn--secundario" (click)="logout()">Cerrar sesión</button>
          </div>
        }
      </div>
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
