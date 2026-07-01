import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

@Component({
  selector: 'ds-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="bg-neutral-900 text-neutral-300">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12">

        <!-- Grid de columnas -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          <!-- Brand column -->
          <div class="col-span-2 md:col-span-1">
            <span class="text-white font-bold text-lg">{{ brandName }}</span>
            @if (tagline) {
              <p class="mt-2 text-sm text-neutral-400 leading-relaxed">{{ tagline }}</p>
            }
            <!-- Redes sociales -->
            <div class="flex gap-3 mt-4">
              @for (social of socials; track social.label) {
                <a
                  [href]="social.href"
                  [attr.aria-label]="social.label"
                  class="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-brand-600 transition-colors text-xs font-bold"
                >
                  {{ social.label[0] }}
                </a>
              }
            </div>
          </div>

          <!-- Link columns -->
          @for (col of columns; track col.title) {
            <div>
              <h4 class="text-white text-sm font-semibold mb-3">{{ col.title }}</h4>
              <ul class="flex flex-col gap-2">
                @for (link of col.links; track link.href) {
                  <li>
                    <a [href]="link.href" class="text-sm text-neutral-400 hover:text-white transition-colors">
                      {{ link.label }}
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <!-- Bottom bar -->
        <div class="border-t border-neutral-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <p>© {{ year }} {{ brandName }}. Todos los derechos reservados.</p>
          <div class="flex gap-4">
            <a href="#" class="hover:text-neutral-300 transition-colors">Privacidad</a>
            <a href="#" class="hover:text-neutral-300 transition-colors">Términos</a>
            <a href="#" class="hover:text-neutral-300 transition-colors">Cookies</a>
          </div>
        </div>

      </div>
    </footer>
  `,
})
export class DsFooter {
  @Input() brandName = 'Mi Tienda';
  @Input() tagline = '';
  @Input() columns: FooterColumn[] = [];
  @Input() socials: { label: string; href: string }[] = [];
  @Input() year = new Date().getFullYear();
}
