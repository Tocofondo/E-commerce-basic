import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'sale' | 'new' | 'out-of-stock' | 'featured' | 'neutral';

@Component({
  selector: 'ds-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="classes">
      <ng-content />
    </span>
  `,
})
export class DsBadge {
  @Input() variant: BadgeVariant = 'neutral';

  get classes(): string {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide';

    const variants: Record<BadgeVariant, string> = {
      sale:        'bg-error-light text-red-700',
      new:         'bg-brand-100 text-brand-700',
      'out-of-stock': 'bg-neutral-100 text-neutral-500',
      featured:    'bg-warning-light text-yellow-700',
      neutral:     'bg-neutral-100 text-neutral-600',
    };

    return [base, variants[this.variant]].join(' ');
  }
}
