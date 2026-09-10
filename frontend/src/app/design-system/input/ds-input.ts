import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

export type InputType = 'text' | 'email' | 'password' | 'search' | 'number' | 'tel';

@Component({
  selector: 'ds-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DsInput),
      multi: true,
    },
  ],
  template: `
    <div class="flex flex-col gap-1">
      @if (label) {
        <label [for]="inputId" class="text-sm font-medium text-neutral-700">
          {{ label }}
          @if (required) { <span class="text-error ml-0.5">*</span> }
        </label>
      }

      <div class="relative flex items-center">
        @if (prefixIcon) {
          <span class="absolute left-3 text-neutral-400 pointer-events-none">
            {{ prefixIcon }}
          </span>
        }

        <input
          [id]="inputId"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="isDisabled"
          [required]="required"
          [value]="value"
          (input)="onInput($event)"
          (blur)="onTouched()"
          [class]="inputClasses"
        />
      </div>

      @if (hint && !error) {
        <p class="text-xs text-neutral-500">{{ hint }}</p>
      }
      @if (error) {
        <p class="text-xs text-error">{{ error }}</p>
      }
    </div>
  `,
})
export class DsInput implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() type: InputType = 'text';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() prefixIcon = '';
  @Input() inputId = `ds-input-${Math.random().toString(36).slice(2, 7)}`;
  @Output() valueChange = new EventEmitter<string>();

  value = '';
  isDisabled = false;
  onChange = (_: string) => {};
  onTouched = () => {};

  get inputClasses(): string {
    const base = 'w-full rounded-lg border bg-surface text-neutral-800 text-sm transition-colors placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-neutral-50 disabled:cursor-not-allowed';
    const padding = this.prefixIcon ? 'pl-9 pr-3 py-2' : 'px-3 py-2';
    const border = this.error ? 'border-error' : 'border-border';
    return [base, padding, border].join(' ');
  }

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.onChange(val);
    this.valueChange.emit(val);
  }

  writeValue(val: string) { this.value = val ?? ''; }
  registerOnChange(fn: (_: string) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void) { this.onTouched = fn; }
  setDisabledState(disabled: boolean) { this.isDisabled = disabled; }
}
