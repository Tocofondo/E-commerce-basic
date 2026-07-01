import { Component, Input } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ds-spinner',
  standalone: true,
  template: `
    <div role="status" [class]="classes" aria-label="Cargando...">
      <span class="sr-only">Cargando...</span>
    </div>
  `,
})
export class DsSpinner {
  @Input() size: SpinnerSize = 'md';
  @Input() color: 'brand' | 'white' | 'neutral' = 'brand';

  get classes(): string {
    const sizes: Record<SpinnerSize, string> = {
      sm: 'w-4 h-4 border-2',
      md: 'w-8 h-8 border-[3px]',
      lg: 'w-12 h-12 border-4',
    };
    const colors = {
      brand:   'border-brand-200 border-t-brand-600',
      white:   'border-white/30 border-t-white',
      neutral: 'border-neutral-200 border-t-neutral-600',
    };
    return `rounded-full animate-spin ${sizes[this.size]} ${colors[this.color]}`;
  }
}
