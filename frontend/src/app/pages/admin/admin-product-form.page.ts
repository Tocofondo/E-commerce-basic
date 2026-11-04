import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DsButton, DsInput } from '../../design-system/index';
import { ProductService } from '../../core/services/product.service';
import { ProductImage, ProductInput } from '../../core/models/product.model';
import { apiErrorMessage } from '../../core/http-error';
import { BadgeVariant } from '../../design-system/index';
import { ImagePrepareError, prepareImageForUpload } from '../../core/image-upload';

// Mismo valor que MAX_IMAGES_PER_PRODUCT en backend/app/modules/products/
// service.py: esto es solo feedback inmediato, la validación real es del
// servidor (tipo, tamaño y contenido, ver products/images.py).
const MAX_IMAGES_PER_PRODUCT = 4;

/** Imagen elegida que todavía no se subió (se sube al guardar). */
interface PendingImage {
  file: File;
  preview: string;
}

// Etiquetas que se pueden asignar a mano ('out-of-stock' no: eso lo decide
// el stock). Mismos valores que BadgeVariant en el backend.
const BADGE_OPTIONS: { variant: BadgeVariant; label: string }[] = [
  { variant: 'sale', label: 'Oferta' },
  { variant: 'new', label: 'Nuevo' },
  { variant: 'featured', label: 'Destacado' },
];

@Component({
  selector: 'app-admin-product-form-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DsButton, DsInput],
  template: `
    <div class="max-w-xl flex flex-col gap-6">
      <h1 class="text-2xl font-bold text-neutral-800">{{ isEdit ? 'Editar producto' : 'Nuevo producto' }}</h1>

      <form class="flex flex-col gap-4" (ngSubmit)="onSubmit()">
        <ds-input label="Nombre" [required]="true" [(ngModel)]="form.name" name="name" />
        <ds-input label="Categoría" [required]="true" [(ngModel)]="form.category" name="category" />

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-neutral-700">
            Imágenes ({{ imageCount() }}/{{ maxImages }})
          </span>

          @if (imageCount() > 0) {
            <!-- Una sola grilla en el orden final: primero las ya subidas, después
                 las pendientes (se suben al guardar, en este orden). La primera es
                 la portada. -->
            <ul class="grid grid-cols-3 sm:grid-cols-4 gap-3">
              @for (img of existingImages(); track img.id; let i = $index; let first = $first; let last = $last) {
                <li class="relative">
                  <img [src]="img.thumbUrl" class="aspect-square w-full object-cover rounded-lg border border-border bg-neutral-100" alt="" />
                  @if (first) {
                    <span class="absolute top-1 left-1 rounded bg-brand-600 text-white text-[10px] font-medium px-1.5 py-0.5">Portada</span>
                  }
                  <button type="button" (click)="onDeleteExistingImage(img.id)" class="absolute -top-2 -right-2 w-6 h-6 bg-error text-white rounded-full text-sm leading-none" aria-label="Eliminar imagen">×</button>
                  <div class="mt-1 flex justify-center gap-1">
                    <button type="button" class="tile-btn" [disabled]="first || reordering()" (click)="moveExisting(i, -1)" aria-label="Mover antes">◀</button>
                    @if (!first) {
                      <button type="button" class="tile-btn" [disabled]="reordering()" (click)="moveExisting(i, -i)" title="Usar de portada" aria-label="Usar de portada">★</button>
                    }
                    <button type="button" class="tile-btn" [disabled]="last || reordering()" (click)="moveExisting(i, 1)" aria-label="Mover después">▶</button>
                  </div>
                </li>
              }
              @for (item of pending(); track item.preview; let i = $index; let first = $first; let last = $last) {
                <li class="relative">
                  <img [src]="item.preview" class="aspect-square w-full object-cover rounded-lg border border-dashed border-brand-500 bg-neutral-100" alt="" />
                  @if (first && existingImages().length === 0) {
                    <span class="absolute top-1 left-1 rounded bg-brand-600 text-white text-[10px] font-medium px-1.5 py-0.5">Portada</span>
                  }
                  <span class="absolute bottom-8 left-1 rounded bg-neutral-800/80 text-white text-[10px] px-1.5 py-0.5">Sin subir</span>
                  <button type="button" (click)="removePending(i)" class="absolute -top-2 -right-2 w-6 h-6 bg-error text-white rounded-full text-sm leading-none" aria-label="Quitar">×</button>
                  <div class="mt-1 flex justify-center gap-1">
                    <button type="button" class="tile-btn" [disabled]="first" (click)="movePending(i, -1)" aria-label="Mover antes">◀</button>
                    <button type="button" class="tile-btn" [disabled]="last" (click)="movePending(i, 1)" aria-label="Mover después">▶</button>
                  </div>
                </li>
              }
            </ul>
          }

          @if (imageCount() < maxImages) {
            <label
              class="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors"
              [class.border-brand-500]="dragging()"
              [class.bg-brand-50]="dragging()"
              [class.border-border]="!dragging()"
              (dragover)="onDragOver($event)"
              (dragleave)="dragging.set(false)"
              (drop)="onDrop($event)"
            >
              <span class="text-sm font-medium text-neutral-700">
                @if (preparing()) { Preparando imágenes… } @else { Arrastrá fotos acá o tocá para elegir }
              </span>
              <span class="text-xs text-neutral-500">
                JPG, PNG, WEBP o GIF (HEIC del iPhone también, desde Safari). Se achican y optimizan solas.
              </span>
              <input type="file" accept="image/*" multiple class="sr-only" [disabled]="preparing()" (change)="onFilesSelected($event)" />
            </label>
          }
          @if (imageError()) {
            <p class="text-xs text-error">{{ imageError() }}</p>
          }
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-neutral-700">Descripción</label>
          <textarea
            [(ngModel)]="form.description"
            name="description"
            rows="3"
            class="w-full rounded-lg border border-border bg-surface text-neutral-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <ds-input label="Precio" type="number" [required]="true" [(ngModel)]="priceStr" name="price" />
          <ds-input label="Precio anterior (opcional)" type="number" [(ngModel)]="originalPriceStr" name="originalPrice" />
        </div>

        <ds-input label="Stock" type="number" [required]="true" [(ngModel)]="stockStr" name="stock" />

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-neutral-700">Etiqueta</label>
            <select
              [(ngModel)]="badgeVariant"
              (ngModelChange)="onBadgeVariantChange($event)"
              name="badgeVariant"
              class="w-full rounded-lg border border-border bg-surface text-neutral-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">Sin etiqueta</option>
              @for (option of badgeOptions; track option.variant) {
                <option [value]="option.variant">{{ option.label }}</option>
              }
            </select>
          </div>
          @if (badgeVariant) {
            <ds-input label="Texto de la etiqueta" [required]="true" [(ngModel)]="badgeLabel" name="badgeLabel" />
          }
        </div>

        @if (uploadProgress() !== null) {
          <div class="flex flex-col gap-1" role="status">
            <span class="text-xs text-neutral-500">
              @if (uploadProgress()! < 1) { Subiendo imágenes… {{ uploadPercent() }}% } @else { Procesando imágenes… }
            </span>
            <div class="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div class="h-full bg-brand-500 transition-[width]" [style.width.%]="uploadPercent()"></div>
            </div>
          </div>
        }

        @if (error()) {
          <p class="text-sm text-error">{{ error() }}</p>
        }

        <div class="flex gap-3 mt-2">
          <ds-button variant="primary" type="submit" [loading]="loading()" [disabled]="preparing()">Guardar</ds-button>
          <a routerLink="/admin/productos">
            <ds-button variant="ghost" type="button">Cancelar</ds-button>
          </a>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .tile-btn {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid var(--color-border, #e5e5e5);
        font-size: 12px;
        line-height: 1;
        color: #525252;
        background: white;
      }
      .tile-btn:disabled { opacity: 0.35; }
    `,
  ],
})
export class AdminProductFormPage implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productsSrv = inject(ProductService);

  isEdit = false;
  private editingId: number | null = null;

  form = {
    name: '',
    category: '',
    description: '',
  };

  priceStr = '0';
  originalPriceStr = '';
  stockStr = '0';

  // Badge del producto (lo que muestra <ds-badge> en la card). Antes no
  // había forma de editarlo desde acá.
  badgeOptions = BADGE_OPTIONS;
  badgeVariant: BadgeVariant | '' = '';
  badgeLabel = '';

  maxImages = MAX_IMAGES_PER_PRODUCT;
  existingImages = signal<ProductImage[]>([]);
  pending = signal<PendingImage[]>([]);
  imageCount = computed(() => this.existingImages().length + this.pending().length);
  imageError = signal('');
  /** Achicando/convirtiendo en el navegador las fotos recién elegidas. */
  preparing = signal(false);
  reordering = signal(false);
  dragging = signal(false);
  /** 0..1 mientras se suben las pendientes; null si no hay subida en curso. */
  uploadProgress = signal<number | null>(null);
  uploadPercent = computed(() => Math.round((this.uploadProgress() ?? 0) * 100));

  error = signal('');
  loading = signal(false);

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEdit = true;
      this.editingId = Number(idParam);
      this.loadForEdit(this.editingId);
    }
  }

  ngOnDestroy(): void {
    for (const item of this.pending()) URL.revokeObjectURL(item.preview);
  }

  /** El producto puede no estar aún en memoria si se entra directo a esta
   * URL (ej. F5) antes de que termine el fetch inicial del catálogo. */
  private async loadForEdit(id: number): Promise<void> {
    let product = this.productsSrv.getAnyById(id);
    if (!product) {
      await this.productsSrv.refresh();
      product = this.productsSrv.getAnyById(id);
    }
    if (!product) return;

    this.form = {
      name: product.name,
      category: product.category,
      description: product.description,
    };
    this.priceStr = String(product.price);
    this.originalPriceStr = product.originalPrice ? String(product.originalPrice) : '';
    this.stockStr = String(product.stock);
    this.badgeVariant = product.badge?.variant ?? '';
    this.badgeLabel = product.badge?.label ?? '';
    this.existingImages.set(product.images);
  }

  /** Al elegir una etiqueta, sugerir su texto por defecto (editable). */
  onBadgeVariantChange(variant: BadgeVariant | ''): void {
    const option = BADGE_OPTIONS.find(o => o.variant === variant);
    const isDefaultLabel = !this.badgeLabel || BADGE_OPTIONS.some(o => o.label === this.badgeLabel);
    if (option && isDefaultLabel) this.badgeLabel = option.label;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // permite volver a elegir el mismo archivo si se quita y se re-agrega
    this.addFiles(files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault(); // sin esto el navegador abre el archivo en vez de soltarlo acá
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.preparing()) return;
    this.addFiles(Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/') || !f.type));
  }

  /** Achica/convierte en el navegador (ver core/image-upload.ts) y las suma
   * como pendientes, respetando el máximo por producto. */
  private async addFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    this.imageError.set('');
    const slotsLeft = MAX_IMAGES_PER_PRODUCT - this.imageCount();
    if (slotsLeft <= 0) {
      this.imageError.set(`Este producto ya tiene el máximo de ${MAX_IMAGES_PER_PRODUCT} imágenes.`);
      return;
    }
    if (files.length > slotsLeft) {
      this.imageError.set(
        `Solo se agregaron ${slotsLeft} de ${files.length} imágenes (máximo ${MAX_IMAGES_PER_PRODUCT} por producto).`,
      );
    }

    this.preparing.set(true);
    try {
      const prepared: PendingImage[] = [];
      for (const file of files.slice(0, slotsLeft)) {
        try {
          const ready = await prepareImageForUpload(file);
          prepared.push({ file: ready, preview: URL.createObjectURL(ready) });
        } catch (err) {
          this.imageError.set(err instanceof ImagePrepareError ? err.message : `No se pudo leer "${file.name}".`);
        }
      }
      this.pending.update(list => [...list, ...prepared]);
    } finally {
      this.preparing.set(false);
    }
  }

  removePending(index: number): void {
    URL.revokeObjectURL(this.pending()[index].preview);
    this.pending.update(list => list.filter((_, i) => i !== index));
  }

  movePending(index: number, delta: number): void {
    this.pending.update(list => moved(list, index, delta));
  }

  /** Reordena las ya subidas (se guarda al toque en el backend; `-index`
   * la manda primera = portada). Optimista: si falla, vuelve atrás. */
  async moveExisting(index: number, delta: number): Promise<void> {
    if (this.editingId === null) return;
    const before = this.existingImages();
    const after = moved(before, index, delta);
    this.existingImages.set(after);
    this.imageError.set('');
    this.reordering.set(true);
    try {
      const product = await this.productsSrv.reorderImages(this.editingId, after.map(img => img.id));
      this.existingImages.set(product.images);
    } catch (err) {
      this.existingImages.set(before);
      this.imageError.set(apiErrorMessage(err, 'No se pudo cambiar el orden de las imágenes.'));
    } finally {
      this.reordering.set(false);
    }
  }

  async onDeleteExistingImage(imageId: string): Promise<void> {
    if (this.editingId === null) return;
    if (!confirm('¿Eliminar esta imagen?')) return;
    try {
      await this.productsSrv.deleteImage(this.editingId, imageId);
      this.existingImages.update(list => list.filter(img => img.id !== imageId));
    } catch {
      this.imageError.set('No se pudo eliminar la imagen.');
    }
  }

  async onSubmit(): Promise<void> {
    const price = Number(this.priceStr);
    // null explícito (no undefined): la edición es parcial y un campo que no
    // viaja queda como estaba, así que vaciar el input tiene que mandar null.
    const originalPrice = this.originalPriceStr ? Number(this.originalPriceStr) : null;
    const stock = Number(this.stockStr);

    // `Number('')` es 0: sin esto, borrar el precio guardaba el producto gratis.
    if (!String(this.priceStr).trim() || !Number.isFinite(price) || price <= 0) {
      this.error.set('Ingresá un precio mayor a 0.');
      return;
    }
    if (originalPrice !== null && (!Number.isFinite(originalPrice) || originalPrice < 0)) {
      this.error.set('El precio anterior tiene que ser un número válido.');
      return;
    }
    if (!String(this.stockStr).trim() || !Number.isInteger(stock) || stock < 0) {
      this.error.set('El stock tiene que ser un número entero, 0 o más.');
      return;
    }

    if (this.badgeVariant && !this.badgeLabel.trim()) {
      this.error.set('Completá el texto de la etiqueta o elegí "Sin etiqueta".');
      return;
    }

    const data: ProductInput = {
      name: this.form.name,
      category: this.form.category,
      description: this.form.description,
      price,
      originalPrice,
      stock,
      badge: this.badgeVariant ? { variant: this.badgeVariant, label: this.badgeLabel.trim() } : null,
    };

    this.error.set('');
    this.loading.set(true);
    try {
      let productId: number;
      try {
        if (this.editingId !== null) {
          productId = Number((await this.productsSrv.update(this.editingId, data)).id);
        } else {
          productId = Number((await this.productsSrv.create(data)).id);
          // Desde acá el producto ya existe: si falla la subida de imágenes,
          // el reintento tiene que editarlo, no crear otro (antes quedaba
          // duplicado).
          this.editingId = productId;
          this.isEdit = true;
        }
      } catch (err) {
        this.error.set(apiErrorMessage(err, 'No se pudo guardar el producto. Revisá los datos.'));
        return;
      }

      if (this.pending().length) {
        this.uploadProgress.set(0);
        try {
          const uploaded = await this.productsSrv.uploadImages(
            productId,
            this.pending().map(item => item.file),
            fraction => this.uploadProgress.set(fraction),
          );
          this.existingImages.update(list => [...list, ...uploaded]);
          this.clearPending();
        } catch (err) {
          this.error.set(
            apiErrorMessage(
              err,
              'El producto se guardó, pero no se pudieron subir las imágenes. Probá de nuevo.',
            ),
          );
          return;
        } finally {
          this.uploadProgress.set(null);
        }
      }

      this.router.navigate(['/admin/productos']);
    } finally {
      this.loading.set(false);
    }
  }

  private clearPending(): void {
    for (const item of this.pending()) URL.revokeObjectURL(item.preview);
    this.pending.set([]);
  }
}

/** Copia de `list` con el elemento `index` movido `delta` lugares. */
function moved<T>(list: T[], index: number, delta: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, index + delta));
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  return copy;
}
