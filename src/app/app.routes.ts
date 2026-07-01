import { Routes } from '@angular/router';
import { StoreLayout } from './layouts/store-layout';
import { AdminLayout } from './layouts/admin-layout';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { LoginPage } from './pages/login.page';
import { HomePage } from './pages/home.page';
import { CatalogPage } from './pages/catalog.page';
import { ProductDetailPage } from './pages/product-detail.page';
import { CartPage } from './pages/cart.page';
import { CheckoutPage } from './pages/checkout.page';
import { OrdersPage } from './pages/orders.page';
import { ProfilePage } from './pages/profile.page';
import { AdminDashboardPage } from './pages/admin/admin-dashboard.page';
import { AdminProductsPage } from './pages/admin/admin-products.page';
import { AdminProductFormPage } from './pages/admin/admin-product-form.page';
import { AdminOrdersPage } from './pages/admin/admin-orders.page';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  {
    path: '',
    component: StoreLayout,
    children: [
      { path: '', component: HomePage },
      { path: 'productos', component: CatalogPage },
      { path: 'productos/:id', component: ProductDetailPage },
      { path: 'carrito', component: CartPage },
      { path: 'checkout', component: CheckoutPage, canActivate: [authGuard] },
      { path: 'mis-pedidos', component: OrdersPage, canActivate: [authGuard] },
      { path: 'perfil', component: ProfilePage, canActivate: [authGuard] },
    ],
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [adminGuard],
    children: [
      { path: '', component: AdminDashboardPage },
      { path: 'productos', component: AdminProductsPage },
      { path: 'productos/nuevo', component: AdminProductFormPage },
      { path: 'productos/:id', component: AdminProductFormPage },
      { path: 'pedidos', component: AdminOrdersPage },
    ],
  },
  { path: '**', redirectTo: '' },
];
