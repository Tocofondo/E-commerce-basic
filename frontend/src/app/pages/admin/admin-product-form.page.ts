import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DsButton, DsInput } from '../../design-system/index';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';

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
        <ds-input label="Imagen (URL)" [required]="true" [(ngModel)]="form.image" name="image" />

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

        <div class="flex gap-3 mt-2">
          <ds-button variant="primary" type="submit">Guardar</ds-button>
          <a routerLink="/admin/productos">
            <ds-button variant="ghost" type="button">Cancelar</ds-button>
          </a>
        </div>
      </form>
    </div>
  `,
})
export class AdminProductFormPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productsSrv = inject(ProductService);

  isEdit = false;
  private editingId: number | null = null;

  form = {
    name: '',
    category: '',
    image: '',
    description: '',
  };

  priceStr = '0';
  originalPriceStr = '';
  stockStr = '0';

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const product = this.productsSrv.getById(Number(idParam));
      if (product) {
        this.isEdit = true;
        this.editingId = Number(idParam);
        this.form = {
          name: product.name,
          category: product.category,
          image: product.image,
          description: product.description,
        };
        this.priceStr = String(product.price);
        this.originalPriceStr = product.originalPrice ? String(product.originalPrice) : '';
        this.stockStr = String(product.stock);
      }
    }
  }

  onSubmit(): void {
    const price = Number(this.priceStr);
    const originalPrice = this.originalPriceStr ? Number(this.originalPriceStr) : undefined;
    const stock = Number(this.stockStr);

    const data: Omit<Product, 'id'> = {
      name: this.form.name,
      category: this.form.category,
      image: this.form.image,
      description: this.form.description,
      price,
      originalPrice,
      stock,
      inStock: stock > 0,
    };

    if (this.isEdit && this.editingId !== null) {
      this.productsSrv.update(this.editingId, data);
    } else {
      this.productsSrv.create(data);
    }

    this.router.navigate(['/admin/productos']);
  }
}
