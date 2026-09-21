import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DsBadge, BadgeVariant } from '../badge/ds-badge';
import { DsButton } from '../button/ds-button';
import { DsPrice } from '../price/ds-price';

// Intervalo entre imágenes y duración del fade: valores "prudentes" — ni
// tan rápido que se sienta parpadeante, ni tan lento que no se note que hay
// más de una foto.
const CAROUSEL_INTERVAL_MS = 3500;
const FADE_DURATION_MS = 250;

export interface ProductCard {
  id: string | number;
  name: string;
  image: string;
  // Opcional: si trae más de una, la card las rota sola. Solo pide `url`
  // (no el tipo completo de ProductImage) para no acoplar el design-system
  // a los modelos de la app.
  images?: { url: string }[];
  price: number;
  originalPrice?: number;
  badge?: { label: string; variant: BadgeVariant };
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
}

@Component({
  selector: 'ds-card-product',
  standalone: true,
  imports: [CommonModule, DsBadge, DsButton, DsPrice],
  template: `
    <article class="bg-surface rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
      <!-- imagen -->
      <div
        class="relative overflow-hidden aspect-square bg-neutral-100"
        (mouseenter)="pauseCarousel()"
        (mouseleave)="resumeCarousel()"
      >
        <img
          [src]="currentImageUrl()"
          [alt]="product.name"
          class="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
          [class.opacity-0]="fading()"
          loading="lazy"
        />
        @if (product.badge) {
          <div class="absolute top-3 left-3">
            <ds-badge [variant]="product.badge.variant">{{ product.badge.label }}</ds-badge>
          </div>
        }
        @if (galleryImages().length > 1) {
          <div class="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1">
            @for (img of galleryImages(); track $index) {
              <span
                class="w-1.5 h-1.5 rounded-full transition-colors"
                [class.bg-surface]="$index === imageIndex()"
                [class.bg-white/50]="$index !== imageIndex()"
              ></span>
            }
          </div>
        }
        <button
          (click)="wishlistToggled.emit(product.id)"
          class="absolute top-3 right-3 w-8 h-8 bg-surface rounded-full flex items-center justify-center shadow-sm border border-border hover:bg-neutral-50 transition-colors"
          aria-label="Agregar a favoritos"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <!-- info -->
      <div class="p-4 flex flex-col gap-2 flex-1">
        <h3 class="text-sm font-medium text-neutral-800 line-clamp-2 leading-snug">{{ product.name }}</h3>

        @if (product.rating) {
          <div class="flex items-center gap-1">
            @for (star of stars; track $index) {
              <svg [class]="starClass(star)" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            }
            @if (product.reviewCount) {
              <span class="text-xs text-neutral-500 ml-1">({{ product.reviewCount }})</span>
            }
          </div>
        }

        <div class="mt-auto pt-2 flex items-end justify-between gap-2">
          <ds-price
            [current]="product.price"
            [original]="product.originalPrice ?? null"
            size="sm"
          />
          <ds-button
            size="sm"
            [disabled]="product.inStock === false"
            (clicked)="addToCart.emit(product.id)"
          >
            {{ product.inStock === false ? 'Sin stock' : 'Agregar' }}
          </ds-button>
        </div>
      </div>
    </article>
  `,
})
export class DsCardProduct implements OnChanges, OnDestroy {
  @Input({ required: true }) product!: ProductCard;
  @Output() addToCart = new EventEmitter<string | number>();
  @Output() wishlistToggled = new EventEmitter<string | number>();

  imageIndex = signal(0);
  fading = signal(false);

  private carouselTimer?: ReturnType<typeof setInterval>;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  private hovered = false;

  /** `product.images` si hay, si no una galería de una sola foto (`product.image`,
   * ya con el fallback de placeholder aplicado por ProductService). */
  galleryImages(): { url: string }[] {
    return this.product.images?.length ? this.product.images : [{ url: this.product.image }];
  }

  currentImageUrl(): string {
    return this.galleryImages()[this.imageIndex()]?.url ?? this.product.image;
  }

  ngOnChanges(): void {
    this.imageIndex.set(0);
    this.fading.set(false);
    if (!this.hovered) this.restartCarousel();
  }

  ngOnDestroy(): void {
    this.stopCarousel();
  }

  pauseCarousel(): void {
    this.hovered = true;
    this.stopCarousel();
  }

  resumeCarousel(): void {
    this.hovered = false;
    this.restartCarousel();
  }

  private restartCarousel(): void {
    this.stopCarousel();
    if (this.galleryImages().length > 1) {
      this.carouselTimer = setInterval(() => this.advance(), CAROUSEL_INTERVAL_MS);
    }
  }

  private stopCarousel(): void {
    if (this.carouselTimer !== undefined) {
      clearInterval(this.carouselTimer);
      this.carouselTimer = undefined;
    }
    if (this.fadeTimer !== undefined) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = undefined;
    }
  }

  /** Fade-out, cambia de foto, fade-in — evita el corte seco entre imágenes. */
  private advance(): void {
    this.fading.set(true);
    this.fadeTimer = setTimeout(() => {
      const count = this.galleryImages().length;
      this.imageIndex.update(i => (i + 1) % count);
      this.fading.set(false);
    }, FADE_DURATION_MS);
  }

  get stars(): number[] {
    return [1, 2, 3, 4, 5];
  }

  starClass(star: number): string {
    const filled = star <= Math.round(this.product.rating ?? 0);
    return `w-3.5 h-3.5 ${filled ? 'text-warning' : 'text-neutral-200'}`;
  }
}
