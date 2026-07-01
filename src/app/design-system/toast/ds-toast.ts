import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'ds-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      role="alert"
      [class]="classes"
    >
      <span class="text-lg leading-none">{{ icon }}</span>
      <div class="flex-1 min-w-0">
        @if (title) { <p class="text-sm font-semibold">{{ title }}</p> }
        @if (message) { <p class="text-sm opacity-90">{{ message }}</p> }
      </div>
      @if (dismissible) {
        <button
          (click)="dismissed.emit()"
          class="ml-2 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
          aria-label="Cerrar"
        >×</button>
      }
    </div>
  `,
})
export class DsToast {
  @Input() variant: ToastVariant = 'info';
  @Input() title = '';
  @Input() message = '';
  @Input() dismissible = true;
  @Output() dismissed = new EventEmitter<void>();

  get icon(): string {
    const icons: Record<ToastVariant, string> = {
      success: '✓',
      error:   '✕',
      warning: '⚠',
      info:    'ℹ',
    };
    return icons[this.variant];
  }

  get classes(): string {
    const base = 'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm max-w-sm';
    const variants: Record<ToastVariant, string> = {
      success: 'bg-success-light border-green-200 text-green-800',
      error:   'bg-error-light border-red-200 text-red-800',
      warning: 'bg-warning-light border-yellow-200 text-yellow-800',
      info:    'bg-brand-50 border-brand-200 text-brand-800',
    };
    return [base, variants[this.variant]].join(' ');
  }
}
