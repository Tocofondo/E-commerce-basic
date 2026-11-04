import { Routes } from '@angular/router';
import { StoreLayout } from './layouts/store-layout';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { LoginPage } from './pages/login.page';
import { RegisterPage } from './pages/register.page';
import { ForgotPasswordPage } from './pages/forgot-password.page';
import { ResetPasswordPage } from './pages/reset-password.page';
import { HomePage } from './pages/home.page';
import { CatalogPage } from './pages/catalog.page';
import { ProductDetailPage } from './pages/product-detail.page';
import { CartPage } from './pages/cart.page';
import { CheckoutPage } from './pages/checkout.page';
import { OrdersPage } from './pages/orders.page';
import { ProfilePage } from './pages/profile.page';
import { WithdrawalPage } from './pages/withdrawal.page';
import { TermsPage } from './pages/terms.page';
import { PrivacyPage } from './pages/privacy.page';
import { BrandDemoComponent } from './shared/brand/brand-demo.component';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'marca', component: BrandDemoComponent },
  {
    path: '',
    component: StoreLayout,
    children: [
      { path: '', component: HomePage },
      { path: 'productos', component: CatalogPage },
      { path: 'productos/:id', component: ProductDetailPage },
      { path: 'carrito', component: CartPage },
      // Sin login: se puede comprar como invitado (deja email o teléfono).
      { path: 'checkout', component: CheckoutPage },
      { path: 'mis-pedidos', component: OrdersPage, canActivate: [authGuard] },
      { path: 'perfil', component: ProfilePage, canActivate: [authGuard] },
      // Botón de arrepentimiento: público, sin login (Res. 424/2020).
      { path: 'arrepentimiento', component: WithdrawalPage },
      { path: 'terminos', component: TermsPage },
      { path: 'privacidad', component: PrivacyPage },
    ],
  },
  // Admin en chunks aparte (lazy): la tienda no descarga su código.
  {
    path: 'admin',
    loadComponent: () => import('./layouts/admin-layout').then(m => m.AdminLayout),
    canActivate: [adminGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/admin/admin-dashboard.page').then(m => m.AdminDashboardPage) },
      { path: 'productos', loadComponent: () => import('./pages/admin/admin-products.page').then(m => m.AdminProductsPage) },
      { path: 'productos/nuevo', loadComponent: () => import('./pages/admin/admin-product-form.page').then(m => m.AdminProductFormPage) },
      { path: 'productos/:id', loadComponent: () => import('./pages/admin/admin-product-form.page').then(m => m.AdminProductFormPage) },
      { path: 'pedidos', loadComponent: () => import('./pages/admin/admin-orders.page').then(m => m.AdminOrdersPage) },
      { path: 'arrepentimientos', loadComponent: () => import('./pages/admin/admin-withdrawals.page').then(m => m.AdminWithdrawalsPage) },
      { path: 'promociones', loadComponent: () => import('./pages/admin/admin-promotions.page').then(m => m.AdminPromotionsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
