import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ds-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="classes"
      (click)="clicked.emit($event)"
    >
      @if (loading) {
        <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
      }
      <ng-content />
    </button>
  `,
})
export class DsButton {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() fullWidth = false;
  @Output() clicked = new EventEmitter<MouseEvent>();

  get classes(): string {
    const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

    const sizes: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
    };

    const variants: Record<ButtonVariant, string> = {
      primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
      secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 border border-brand-200',
      ghost:     'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
      danger:    'bg-error text-white hover:bg-red-600 active:bg-red-700',
    };

    const width = this.fullWidth ? 'w-full' : '';

    return [base, sizes[this.size], variants[this.variant], width].filter(Boolean).join(' ');
  }
}
