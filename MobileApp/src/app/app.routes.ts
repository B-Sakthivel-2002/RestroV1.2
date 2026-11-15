import { Routes } from '@angular/router';
import { loginGuard, sessionGuard, startGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [startGuard], children: [] },
  { path: 'connect', loadComponent: () => import('./connect/connect.page').then(m => m.ConnectPage) },
  { path: 'login', canActivate: [loginGuard], loadComponent: () => import('./login/login.page').then(m => m.LoginPage) },
  {
    path: 'order/:tableId/:floorId/:typeId/:tableName',
    canActivate: [sessionGuard],
    loadComponent: () => import('./order/order.page').then(m => m.OrderPage),
  },
  { path: '', loadChildren: () => import('./tabs/tabs.routes').then(m => m.routes) },
  { path: '**', redirectTo: '' },
];
