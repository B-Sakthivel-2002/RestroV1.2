import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { roleGuard } from '../core/guards/role.guard';
import { sessionGuard } from '../core/guards/auth.guard';
import { AuthService } from '../core/services/auth.service';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    canActivate: [sessionGuard],
    children: [
      { path: 'dashboard', data: { tab: 'dashboard' }, canActivate: [roleGuard], loadComponent: () => import('../profile/profile.page').then(m => m.ProfilePage) },
      { path: 'tables', data: { tab: 'tables' }, canActivate: [roleGuard], loadComponent: () => import('../dinein/dinein.page').then(m => m.DineinPage) },
      { path: 'tokens', data: { tab: 'tokens' }, canActivate: [roleGuard], loadComponent: () => import('../tokens/tokens.page').then(m => m.TokensPage) },
      { path: 'kot', data: { tab: 'kot', mode: 'kitchen' }, canActivate: [roleGuard], loadComponent: () => import('../kot/kot.page').then(m => m.KotPage) },
      { path: 'pickup', data: { tab: 'pickup', mode: 'pickup' }, canActivate: [roleGuard], loadComponent: () => import('../kot/kot.page').then(m => m.KotPage) },
      { path: 'orders', data: { tab: 'orders' }, canActivate: [roleGuard], loadComponent: () => import('../orders/orders.page').then(m => m.OrdersPage) },
      { path: 'more', data: { tab: 'more' }, canActivate: [roleGuard], loadComponent: () => import('../more/more.page').then(m => m.MorePage) },
      { path: '', pathMatch: 'full', redirectTo: () => inject(AuthService).homeUrl() },
    ],
  },
];
