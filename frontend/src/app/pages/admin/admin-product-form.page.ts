import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DsButton, DsInput } from '../../design-system/index';
import { ProductService } from '../../core/services/product.service';
import { ProductImage, ProductInput } from '../../core/models/product.model';

// Debe coincidir con lo que valida el backend (ALLOWED_IMAGE_TYPES /
// MAX_IMAGE_SIZE_MB / MAX_IMAGES_PER_PRODUCT en
// backend/app/modules/products/service.py): esto es solo feedback
// inmediato en el form, la validación real es del servidor.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_PRODUCT = 4;

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
          <label class="text-sm font-medium text-neutral-700">
            Imágenes ({{ imageCount() }}/{{ maxImages }})
          </label>

          @if (existingImages().length) {
            <div class="flex flex-wrap gap-2">
              @for (img of existingImages(); track img.id) {
                <div class="relative w-16 h-16">
                  <img [src]="img.url" class="w-16 h-16 object-cover rounded-lg border border-border" alt="" />
                  <button
                    type="button"
                    (click)="onDeleteExistingImage(img.id)"
                    class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full text-xs leading-none"
                    aria-label="Eliminar imagen"
                  >×</button>
                </div>
              }
            </div>
          }

          @if (pendingPreviews().length) {
            <div class="flex flex-wrap gap-2">
              @for (preview of pendingPreviews(); track $index) {
                <div class="relative w-16 h-16">
                  <img [src]="preview" class="w-16 h-16 object-cover rounded-lg border border-border" alt="" />
                  <button
                    type="button"
                    (click)="removePendingFile($index)"
                    class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full text-xs leading-none"
                    aria-label="Quitar"
                  >×</button>
                </div>
              }
            </div>
          }

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            [disabled]="imageCount() >= maxImages"
            (change)="onFilesSelected($event)"
            class="text-sm text-neutral-600 disabled:opacity-50"
          />
          <p class="text-xs text-neutral-500">PNG, JPG, WEBP o GIF. Máximo 5MB por archivo, hasta {{ maxImages }} imágenes por producto.</p>
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

        @if (error()) {
          <p class="text-sm text-error">{{ error() }}</p>
        }

        <div class="flex gap-3 mt-2">
          <ds-button variant="primary" type="submit" [loading]="loading()">Guardar</ds-button>
          <a routerLink="/admin/productos">
            <ds-button variant="ghost" type="button">Cancelar</ds-button>
          </a>
        </div>
      </form>
    </div>
  `,
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

  maxImages = MAX_IMAGES_PER_PRODUCT;
  existingImages = signal<ProductImage[]>([]);
  pendingFiles = signal<File[]>([]);
  pendingPreviews = signal<string[]>([]);
  imageCount = computed(() => this.existingImages().length + this.pendingFiles().length);
  imageError = signal('');

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
    for (const url of this.pendingPreviews()) URL.revokeObjectURL(url);
  }

  /** El producto puede no estar aún en memoria si se entra directo a esta
   * URL (ej. F5) antes de que termine el fetch inicial del catálogo. */
  private async loadForEdit(id: number): Promise<void> {
    let product = this.productsSrv.getById(id);
    if (!product) {
      await this.productsSrv.refresh();
      product = this.productsSrv.getById(id);
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
    this.existingImages.set(product.images);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // permite volver a elegir el mismo archivo si se quita y se re-agrega

    this.imageError.set('');
    const valid: File[] = [];
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        this.imageError.set(`"${file.name}" no es una imagen válida (solo PNG, JPG, WEBP o GIF).`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        this.imageError.set(`"${file.name}" supera el tamaño máximo de 5MB.`);
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) return;

    const currentTotal = this.existingImages().length + this.pendingFiles().length;
    const slotsLeft = MAX_IMAGES_PER_PRODUCT - currentTotal;
    if (slotsLeft <= 0) {
      this.imageError.set(`Este producto ya tiene el máximo de ${MAX_IMAGES_PER_PRODUCT} imágenes.`);
      return;
    }
    if (valid.length > slotsLeft) {
      this.imageError.set(
        `Solo se agregaron ${slotsLeft} de ${valid.length} imágenes (máximo ${MAX_IMAGES_PER_PRODUCT} por producto).`,
      );
    }
    const accepted = valid.slice(0, slotsLeft);

    this.pendingFiles.update(list => [...list, ...accepted]);
    this.pendingPreviews.update(list => [...list, ...accepted.map(f => URL.createObjectURL(f))]);
  }

  removePendingFile(index: number): void {
    URL.revokeObjectURL(this.pendingPreviews()[index]);
    this.pendingFiles.update(list => list.filter((_, i) => i !== index));
    this.pendingPreviews.update(list => list.filter((_, i) => i !== index));
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
    const originalPrice = this.originalPriceStr ? Number(this.originalPriceStr) : undefined;
    const stock = Number(this.stockStr);

    const data: ProductInput = {
      name: this.form.name,
      category: this.form.category,
      description: this.form.description,
      price,
      originalPrice,
      stock,
    };

    this.error.set('');
    this.loading.set(true);
    try {
      const productId =
        this.isEdit && this.editingId !== null
          ? Number((await this.productsSrv.update(this.editingId, data)).id)
          : Number((await this.productsSrv.create(data)).id);

      if (this.pendingFiles().length) {
        await this.productsSrv.uploadImages(productId, this.pendingFiles());
      }

      this.router.navigate(['/admin/productos']);
    } catch {
      this.error.set('No se pudo guardar el producto.');
    } finally {
      this.loading.set(false);
    }
  }
}
