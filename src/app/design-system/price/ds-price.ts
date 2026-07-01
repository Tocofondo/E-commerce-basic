import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ds-price',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-baseline gap-2">
      <span [class]="currentPriceClasses">
        {{ current | currency: currency : 'symbol' : '1.2-2' }}
      </span>
      @if (original && original > current) {
        <span class="text-sm text-neutral-400 line-through">
          {{ original | currency: currency : 'symbol' : '1.2-2' }}
        </span>
        <span class="text-xs font-semibold text-error bg-error-light px-1.5 py-0.5 rounded">
          -{{ discountPercent }}%
        </span>
      }
    </div>
  `,
})
export class DsPrice {
  @Input({ required: true }) current!: number;
  @Input() original: number | null = null;
  @Input() currency = 'USD';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get discountPercent(): number {
    if (!this.original) return 0;
    return Math.round((1 - this.current / this.original) * 100);
  }

  get currentPriceClasses(): string {
    const sizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };
    return `font-bold text-neutral-900 ${sizes[this.size]}`;
  }
}
