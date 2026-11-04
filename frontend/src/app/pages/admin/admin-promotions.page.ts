import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DsBadge, DsButton, DsInput, DsSpinner } from '../../design-system/index';
import { PromotionService } from '../../core/services/promotion.service';
import { ProductService } from '../../core/services/product.service';
import { apiErrorMessage } from '../../core/http-error';
import { Coupon, CouponInput, Promotion, PromotionInput } from '../../core/models/promotion.model';

/** Tipos como los piensa el admin; en el backend son `kind` + campos
 * (ver backend/app/modules/promotions/schemas.py). */
type PromoType = 'quantity' | 'scope' | 'amount';
type Scope = 'all' | 'category' | 'product';

const PROMO_TYPES: { value: PromoType; label: string; hint: string }[] = [
  { value: 'quantity', label: 'Por cantidad', hint: 'Ej. llevando 10 o más del mismo producto, 15% off en esas unidades.' },
  { value: 'scope', label: 'Producto o categoría', hint: 'Ej. 20% en toda la categoría Verano, o en un producto puntual.' },
  { value: 'amount', label: 'Monto mínimo', hint: 'Ej. comprando desde $50.000, 10% off al total.' },
];

interface PromoForm {
  name: string;
  type: PromoType;
  percent: string;
  scope: Scope;
  category: string;
  productId: string;
  minQty: string;
  minAmount: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

interface CouponForm {
  code: string;
  percent: string;
  minAmount: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
}

const emptyPromo = (): PromoForm => ({
  name: '',
  type: 'quantity',
  percent: '10',
  scope: 'all',
  category: '',
  productId: '',
  minQty: '10',
  minAmount: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
});

const emptyCoupon = (): CouponForm => ({
  code: '',
  percent: '10',
  minAmount: '',
  maxUses: '',
  expiresAt: '',
  isActive: true,
});

/** ISO del backend -> valor de <input type="datetime-local"> (hora local). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function optionalNumber(value: string): number | null {
  return String(value).trim() === '' ? null : Number(value);
}

@Component({
  selector: 'app-admin-promotions-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, DsBadge, DsButton, DsInput, DsSpinner],
  template: `
    <div class="flex flex-col gap-10 max-w-3xl">
      <!-- Promociones automáticas -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 class="text-2xl font-bold text-neutral-800">Promociones</h1>
            <p class="text-sm text-neutral-500">Se aplican solas en el carrito. Por producto vale la mejor (no se suman); la de monto mínimo va después, y el cupón al final.</p>
          </div>
          @if (!promoEditing()) {
            <ds-button variant="primary" (clicked)="newPromo()">Nueva promoción</ds-button>
          }
        </div>

        @if (promoEditing()) {
          <form class="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4" (ngSubmit)="savePromo()">
            <h2 class="font-semibold text-neutral-800">{{ promoEditingId() === null ? 'Nueva promoción' : 'Editar promoción' }}</h2>
            <ds-input label="Nombre (lo ve el cliente)" [required]="true" placeholder="Ej. Llevando 10" [(ngModel)]="promo.name" name="name" />

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-neutral-700">Tipo</label>
              <div class="grid sm:grid-cols-3 gap-2">
                @for (t of promoTypes; track t.value) {
                  <label class="border rounded-lg p-3 text-sm cursor-pointer" [class.border-brand-500]="promo.type === t.value" [class.bg-brand-50]="promo.type === t.value" [class.border-border]="promo.type !== t.value">
                    <input type="radio" name="type" class="sr-only" [value]="t.value" [(ngModel)]="promo.type" (ngModelChange)="onTypeChange($event)" />
                    <span class="font-medium text-neutral-800 block">{{ t.label }}</span>
                    <span class="text-xs text-neutral-500">{{ t.hint }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="grid sm:grid-cols-2 gap-4">
              <ds-input label="Descuento (%)" type="number" [required]="true" [(ngModel)]="promo.percent" name="percent" />
              @if (promo.type === 'quantity') {
                <ds-input label="Unidades mínimas del mismo producto" type="number" [required]="true" [(ngModel)]="promo.minQty" name="minQty" />
              }
              @if (promo.type === 'amount') {
                <ds-input label="Monto mínimo de compra ($)" type="number" [required]="true" [(ngModel)]="promo.minAmount" name="minAmount" />
              }
            </div>

            @if (promo.type !== 'amount') {
              <div class="grid sm:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-neutral-700">Aplica a</label>
                  <select class="admin-select" [(ngModel)]="promo.scope" name="scope">
                    @if (promo.type === 'quantity') { <option value="all">Cualquier producto</option> }
                    <option value="category">Una categoría</option>
                    <option value="product">Un producto</option>
                  </select>
                </div>
                @if (promo.scope === 'category') {
                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-neutral-700">Categoría</label>
                    <select class="admin-select" [(ngModel)]="promo.category" name="category">
                      <option value="">Elegí una</option>
                      @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
                    </select>
                  </div>
                }
                @if (promo.scope === 'product') {
                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-neutral-700">Producto</label>
                    <select class="admin-select" [(ngModel)]="promo.productId" name="productId">
                      <option value="">Elegí uno</option>
                      @for (p of products.allProducts(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
                    </select>
                  </div>
                }
              </div>
            }

            <div class="grid sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-neutral-700">Desde (opcional)</label>
                <input type="datetime-local" class="admin-select" [(ngModel)]="promo.startsAt" name="startsAt" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-neutral-700">Hasta (opcional)</label>
                <input type="datetime-local" class="admin-select" [(ngModel)]="promo.endsAt" name="endsAt" />
              </div>
            </div>

            <label class="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" [(ngModel)]="promo.isActive" name="isActive" /> Activa
            </label>

            @if (promoError()) { <p class="text-sm text-error">{{ promoError() }}</p> }
            <div class="flex gap-3">
              <ds-button variant="primary" type="submit" [loading]="saving()">Guardar</ds-button>
              <ds-button variant="ghost" type="button" (clicked)="promoEditing.set(false)">Cancelar</ds-button>
            </div>
          </form>
        }

        @if (loading()) {
          <div class="py-8 flex justify-center"><ds-spinner /></div>
        } @else if (promotions().length === 0) {
          <p class="text-sm text-neutral-500">Todavía no hay promociones.</p>
        } @else {
          <ul class="flex flex-col gap-2">
            @for (p of promotions(); track p.id) {
              <li class="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-3" [class.opacity-60]="!p.isActive">
                <div class="flex-1 min-w-48">
                  <p class="font-medium text-neutral-800">{{ p.name }} · {{ p.percent }}%</p>
                  <p class="text-sm text-neutral-500">{{ describe(p) }}</p>
                  @if (p.startsAt || p.endsAt) {
                    <p class="text-xs text-neutral-400">
                      {{ p.startsAt ? 'Desde ' + (p.startsAt | date: 'short') : '' }}
                      {{ p.endsAt ? 'hasta ' + (p.endsAt | date: 'short') : '' }}
                    </p>
                  }
                </div>
                <ds-badge [variant]="status(p) === 'Vigente' ? 'new' : 'neutral'">{{ status(p) }}</ds-badge>
                <div class="flex gap-2">
                  <ds-button variant="ghost" size="sm" (clicked)="togglePromo(p)">{{ p.isActive ? 'Pausar' : 'Activar' }}</ds-button>
                  <ds-button variant="ghost" size="sm" (clicked)="editPromo(p)">Editar</ds-button>
                  <ds-button variant="ghost" size="sm" (clicked)="removePromo(p)">Borrar</ds-button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Cupones -->
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-2xl font-bold text-neutral-800">Cupones</h2>
            <p class="text-sm text-neutral-500">El cliente escribe el código en el checkout. Cada comprador lo puede usar una vez; si cancela, se libera.</p>
          </div>
          @if (!couponEditing()) {
            <ds-button variant="primary" (clicked)="newCoupon()">Nuevo cupón</ds-button>
          }
        </div>

        @if (couponEditing()) {
          <form class="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4" (ngSubmit)="saveCoupon()">
            <h2 class="font-semibold text-neutral-800">{{ couponEditingId() === null ? 'Nuevo cupón' : 'Editar cupón' }}</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <ds-input label="Código" [required]="true" placeholder="VERANO10" [(ngModel)]="coupon.code" name="code" />
              <ds-input label="Descuento (%)" type="number" [required]="true" [(ngModel)]="coupon.percent" name="cpercent" />
              <ds-input label="Compra mínima ($, opcional)" type="number" [(ngModel)]="coupon.minAmount" name="cminAmount" />
              <ds-input label="Usos máximos (opcional)" type="number" hint="Vacío = sin límite" [(ngModel)]="coupon.maxUses" name="maxUses" />
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-neutral-700">Vence (opcional)</label>
                <input type="datetime-local" class="admin-select" [(ngModel)]="coupon.expiresAt" name="expiresAt" />
              </div>
            </div>
            <label class="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" [(ngModel)]="coupon.isActive" name="cisActive" /> Activo
            </label>
            @if (couponError()) { <p class="text-sm text-error">{{ couponError() }}</p> }
            <div class="flex gap-3">
              <ds-button variant="primary" type="submit" [loading]="saving()">Guardar</ds-button>
              <ds-button variant="ghost" type="button" (clicked)="couponEditing.set(false)">Cancelar</ds-button>
            </div>
          </form>
        }

        @if (!loading()) {
          @if (coupons().length === 0) {
            <p class="text-sm text-neutral-500">Todavía no hay cupones.</p>
          } @else {
            <ul class="flex flex-col gap-2">
              @for (c of coupons(); track c.id) {
                <li class="bg-surface border border-border rounded-xl p-4 flex flex-wrap items-center gap-3" [class.opacity-60]="!c.isActive">
                  <div class="flex-1 min-w-48">
                    <p class="font-medium text-neutral-800 font-mono">{{ c.code }} · {{ c.percent }}%</p>
                    <p class="text-sm text-neutral-500">
                      Usado {{ c.uses }}{{ c.maxUses ? ' de ' + c.maxUses : '' }} {{ c.uses === 1 ? 'vez' : 'veces' }}
                      @if (c.minAmount) { · desde $ {{ c.minAmount | number: '1.0-2' }} }
                      @if (c.expiresAt) { · vence {{ c.expiresAt | date: 'short' }} }
                    </p>
                    @if (c.origin === 'referral') {
                      <p class="text-xs text-neutral-400">Premio de referido para {{ c.ownerEmail }}</p>
                    }
                  </div>
                  <div class="flex gap-2">
                    @if (c.origin === 'admin') {
                      <ds-button variant="ghost" size="sm" (clicked)="toggleCoupon(c)">{{ c.isActive ? 'Pausar' : 'Activar' }}</ds-button>
                      <ds-button variant="ghost" size="sm" (clicked)="editCoupon(c)">Editar</ds-button>
                    }
                    <ds-button variant="ghost" size="sm" (clicked)="removeCoupon(c)">Borrar</ds-button>
                  </div>
                </li>
              }
            </ul>
          }
        }
      </section>

      @if (listError()) { <p class="text-sm text-error">{{ listError() }}</p> }
    </div>
  `,
  styles: [
    `
      .admin-select {
        width: 100%;
        border-radius: 0.5rem;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-neutral-800);
        font-size: 0.875rem;
        padding: 0.5rem 0.75rem;
      }
    `,
  ],
})
export class AdminPromotionsPage {
  private promotionSrv = inject(PromotionService);
  products = inject(ProductService);

  promoTypes = PROMO_TYPES;
  promotions = signal<Promotion[]>([]);
  coupons = signal<Coupon[]>([]);
  loading = signal(true);
  saving = signal(false);
  listError = signal('');

  promoEditing = signal(false);
  promoEditingId = signal<number | null>(null);
  promo: PromoForm = emptyPromo();
  promoError = signal('');

  couponEditing = signal(false);
  couponEditingId = signal<number | null>(null);
  coupon: CouponForm = emptyCoupon();
  couponError = signal('');

  categories = computed(() =>
    [...new Set(this.products.allProducts().map(p => p.category))].sort((a, b) => a.localeCompare(b)),
  );

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [promotions, coupons] = await Promise.all([
        this.promotionSrv.listPromotions(),
        this.promotionSrv.listCoupons(),
      ]);
      this.promotions.set(promotions);
      this.coupons.set(coupons);
    } catch (err) {
      this.listError.set(apiErrorMessage(err, 'No se pudieron cargar las promociones.'));
    } finally {
      this.loading.set(false);
    }
  }

  describe(p: Promotion): string {
    if (p.kind === 'order') return `Comprando desde $ ${p.minAmount?.toLocaleString('es-AR')}`;
    const target = p.productName ? `"${p.productName}"` : p.category ? `la categoría ${p.category}` : 'cualquier producto';
    return p.minQty > 1 ? `Llevando ${p.minQty} o más unidades de ${target}` : `En ${target}`;
  }

  status(p: Promotion): string {
    const now = Date.now();
    if (!p.isActive) return 'Pausada';
    if (p.startsAt && new Date(p.startsAt).getTime() > now) return 'Programada';
    if (p.endsAt && new Date(p.endsAt).getTime() <= now) return 'Vencida';
    return 'Vigente';
  }

  // --- Promociones ---

  newPromo(): void {
    this.promo = emptyPromo();
    this.promoEditingId.set(null);
    this.promoError.set('');
    this.promoEditing.set(true);
  }

  editPromo(p: Promotion): void {
    this.promo = {
      name: p.name,
      type: p.kind === 'order' ? 'amount' : p.minQty > 1 ? 'quantity' : 'scope',
      percent: String(p.percent),
      scope: p.productId !== null ? 'product' : p.category ? 'category' : 'all',
      category: p.category ?? '',
      productId: p.productId !== null ? String(p.productId) : '',
      minQty: String(p.minQty),
      minAmount: p.minAmount !== null ? String(p.minAmount) : '',
      startsAt: toLocalInput(p.startsAt),
      endsAt: toLocalInput(p.endsAt),
      isActive: p.isActive,
    };
    this.promoEditingId.set(p.id);
    this.promoError.set('');
    this.promoEditing.set(true);
  }

  /** "Producto o categoría" no tiene "todo el catálogo" (sería un descuento
   * general: para eso, un cupón o una promo por monto). */
  onTypeChange(type: PromoType): void {
    if (type === 'scope' && this.promo.scope === 'all') this.promo.scope = 'category';
  }

  /** Form -> body del backend. Devuelve un mensaje si falta algo. */
  private promoBody(): PromotionInput | string {
    const f = this.promo;
    const percent = Number(f.percent);
    if (!f.name.trim()) return 'Poné un nombre.';
    if (!(percent > 0 && percent <= 100)) return 'El descuento tiene que ser entre 1 y 100%.';
    if (f.type === 'amount') {
      const minAmount = optionalNumber(f.minAmount);
      if (minAmount === null || minAmount <= 0) return 'Poné el monto mínimo.';
      return { name: f.name.trim(), kind: 'order', percent, productId: null, category: null, minQty: 1, minAmount, startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt), isActive: f.isActive };
    }
    const scope = f.scope;
    if (scope === 'category' && !f.category) return 'Elegí la categoría.';
    if (scope === 'product' && !f.productId) return 'Elegí el producto.';
    const minQty = f.type === 'quantity' ? Number(f.minQty) : 1;
    if (f.type === 'quantity' && !(Number.isInteger(minQty) && minQty >= 2)) return 'Las unidades mínimas tienen que ser 2 o más.';
    return {
      name: f.name.trim(),
      kind: 'product',
      percent,
      productId: scope === 'product' ? Number(f.productId) : null,
      category: scope === 'category' ? f.category : null,
      minQty,
      minAmount: null,
      startsAt: fromLocalInput(f.startsAt),
      endsAt: fromLocalInput(f.endsAt),
      isActive: f.isActive,
    };
  }

  async savePromo(): Promise<void> {
    const body = this.promoBody();
    if (typeof body === 'string') {
      this.promoError.set(body);
      return;
    }
    this.saving.set(true);
    this.promoError.set('');
    try {
      const saved = await this.promotionSrv.savePromotion(this.promoEditingId(), body);
      this.promotions.update(list =>
        this.promoEditingId() === null ? [saved, ...list] : list.map(p => (p.id === saved.id ? saved : p)),
      );
      this.promoEditing.set(false);
    } catch (err) {
      this.promoError.set(apiErrorMessage(err, 'No se pudo guardar la promoción.'));
    } finally {
      this.saving.set(false);
    }
  }

  async togglePromo(p: Promotion): Promise<void> {
    const { id, productName, createdAt, ...input } = p;
    try {
      const saved = await this.promotionSrv.savePromotion(id, { ...input, isActive: !p.isActive });
      this.promotions.update(list => list.map(x => (x.id === id ? saved : x)));
    } catch (err) {
      this.listError.set(apiErrorMessage(err, 'No se pudo cambiar la promoción.'));
    }
  }

  async removePromo(p: Promotion): Promise<void> {
    if (!confirm(`¿Borrar la promoción "${p.name}"? Los pedidos ya hechos no cambian.`)) return;
    try {
      await this.promotionSrv.deletePromotion(p.id);
      this.promotions.update(list => list.filter(x => x.id !== p.id));
    } catch (err) {
      this.listError.set(apiErrorMessage(err, 'No se pudo borrar la promoción.'));
    }
  }

  // --- Cupones ---

  newCoupon(): void {
    this.coupon = emptyCoupon();
    this.couponEditingId.set(null);
    this.couponError.set('');
    this.couponEditing.set(true);
  }

  editCoupon(c: Coupon): void {
    this.coupon = {
      code: c.code,
      percent: String(c.percent),
      minAmount: c.minAmount !== null ? String(c.minAmount) : '',
      maxUses: c.maxUses !== null ? String(c.maxUses) : '',
      expiresAt: toLocalInput(c.expiresAt),
      isActive: c.isActive,
    };
    this.couponEditingId.set(c.id);
    this.couponError.set('');
    this.couponEditing.set(true);
  }

  private couponBody(): CouponInput | string {
    const f = this.coupon;
    const percent = Number(f.percent);
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(f.code.trim())) return 'El código va de 3 a 40 letras, números, "-" o "_".';
    if (!(percent > 0 && percent <= 100)) return 'El descuento tiene que ser entre 1 y 100%.';
    const maxUses = optionalNumber(f.maxUses);
    if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1)) return 'Los usos máximos tienen que ser 1 o más.';
    return {
      code: f.code.trim().toUpperCase(),
      percent,
      minAmount: optionalNumber(f.minAmount),
      maxUses,
      expiresAt: fromLocalInput(f.expiresAt),
      isActive: f.isActive,
    };
  }

  async saveCoupon(): Promise<void> {
    const body = this.couponBody();
    if (typeof body === 'string') {
      this.couponError.set(body);
      return;
    }
    this.saving.set(true);
    this.couponError.set('');
    try {
      const saved = await this.promotionSrv.saveCoupon(this.couponEditingId(), body);
      this.coupons.update(list =>
        this.couponEditingId() === null ? [saved, ...list] : list.map(c => (c.id === saved.id ? saved : c)),
      );
      this.couponEditing.set(false);
    } catch (err) {
      this.couponError.set(apiErrorMessage(err, 'No se pudo guardar el cupón.'));
    } finally {
      this.saving.set(false);
    }
  }

  async toggleCoupon(c: Coupon): Promise<void> {
    const { id, uses, origin, ownerEmail, createdAt, ...input } = c;
    try {
      const saved = await this.promotionSrv.saveCoupon(id, { ...input, isActive: !c.isActive });
      this.coupons.update(list => list.map(x => (x.id === id ? saved : x)));
    } catch (err) {
      this.listError.set(apiErrorMessage(err, 'No se pudo cambiar el cupón.'));
    }
  }

  async removeCoupon(c: Coupon): Promise<void> {
    if (!confirm(`¿Borrar el cupón ${c.code}? Los pedidos que ya lo usaron no cambian.`)) return;
    try {
      await this.promotionSrv.deleteCoupon(c.id);
      this.coupons.update(list => list.filter(x => x.id !== c.id));
    } catch (err) {
      this.listError.set(apiErrorMessage(err, 'No se pudo borrar el cupón.'));
    }
  }
}
