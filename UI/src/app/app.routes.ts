import { Routes } from '@angular/router';
import { RoleGuard } from './core/guards/role.guard';
import { authGuard,afterLogged } from './core/guards/auth.guard';
import { ProductListComponent } from './pages/product-list.component';
import { MainLayoutComponent } from './pages/main-layout.component';
export const routes: Routes = [
   {
    path:'',
    loadComponent:()=>import('./pages/login.component').then(m=>m.LoginComponent),
     canActivate:[authGuard]
   },
   // Walk-in token booking: full screen without the menu, for the entrance desk / a tablet.
   {
    path:'token-booking',
    loadComponent:()=>import('./pages/token-booking.component').then(m=>m.TokenBookingComponent),
    data:{dataRoles:['Admin','SuperAdmin','Manager','Captain']},
    canActivate:[RoleGuard]
   },
     // ✅ MAIN APP (with header loaded once)
  {
    path: '',
    component: MainLayoutComponent, 
     children: [
      {
         path:'dashboard',
         loadComponent:()=>import('./pages/main-dashboard.component').then(m=>m.MainDashboardComponent),
         canActivate:[RoleGuard],
         data:{dataRoles:['Admin','SuperAdmin','Captain','Chef', 'Cheif']}
      },
      {
         path:'admin-dashboard',
         loadComponent:()=>import('./pages/dashboard.component').then(m=>m.DashboardComponent),
         canActivate: [RoleGuard],
         data:{dataRoles:['Admin','SuperAdmin']}
      },
   {
    path:'kitchens',
    loadComponent:()=>import('./pages/kitchen.component').then(m=>m.KitchenComponent),
    data:{dataRoles:['Admin','SuperAdmin']},
    canActivate: [RoleGuard],
   },
   {
    path:'waitlist',
    loadComponent:()=>import('./pages/waitlist.component').then(m=>m.WaitlistComponent),
    data:{dataRoles:['Admin','SuperAdmin','Manager','Captain']},
    canActivate: [RoleGuard],
   },
   {
    path:'dinein',
    loadComponent:()=>import('./pages/dinein.component').then(m=>m.DineinComponent),
    data:{dataRoles:['Admin','SuperAdmin','Captain']},
    canActivate: [RoleGuard],
   },{
      path:'floors',
      loadComponent:()=>import('./pages/floor-list.component').then(m=>m.FloorListComponent),
      data:{dataRoles:['Admin','SuperAdmin','Captain']},
      canActivate: [RoleGuard],
   },{
      path:'branch',
      loadComponent:()=>import('./pages/branch-list.component').then(m=>m.BranchListComponent),
       data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard],
   },{
      path:'categories',
      loadComponent:()=>import('./pages/categories-list.component').then(m=>m.CategoriesListComponent),
       data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard],
   },{
      path:'customers',
      loadComponent:()=>import('./pages/customer.component').then(m=>m.CustomerComponent),
       data:{dataRoles:['Admin','SuperAdmin','Captain','Chef','Cheif']},
      canActivate: [RoleGuard],
   },{
      path:'waiter',
      loadComponent:()=>import('./pages/waiter.component').then(m=>m.WaiterComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'menu-list',
      loadComponent:()=>import('./pages/menu-list.component').then(m=>m.MenuListComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'menu-type',
      loadComponent:()=>import('./pages/menu-type.component').then(m=>m.MenuTypeComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'order-histroy',
      loadComponent:()=>import('./pages/order-histroy.component').then(m=>m.OrderHistroyComponent),
      canActivate: [RoleGuard],
      data:{dataRoles:['Admin','SuperAdmin','Captain','Cheif','Chef']}
   },{
      path:'order-report',
      loadComponent:()=>import('./pages/order-report.component').then(m=>m.OrderReportComponent),
      canActivate: [RoleGuard],
      data:{dataRoles:['Admin','SuperAdmin','Captain','Cheif','Chef']}
   },
   {
      path:'kot-list',
      loadComponent:()=>import('./pages/kot-list.component').then(m=>m.KotListComponent),
      data:{dataRoles:['Admin','SuperAdmin','Captain','Cheif']},
      canActivate: [RoleGuard]
   },
   {
      path:'kot-list/:type',
      loadComponent:()=>import('./pages/kot-list.component').then(m=>m.KotListComponent),
       data:{dataRoles:['Admin','SuperAdmin','Captain','Cheif']},
      canActivate: [RoleGuard]

   },
   {
      path:'order-type',
      loadComponent:()=>import('./pages/order-type.component').then(m=>m.OrderTypeComponent),
       data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'tax',
      loadComponent:()=>import('./pages/tax.component').then(m=>m.TaxComponent),
       data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'extra-charge',
      loadComponent:()=>import('./pages/extra-charge.component').then(m=>m.ExtraChargeComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'discount',
      loadComponent:()=>import('./pages/discount.component').then(m=>m.DiscountComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'tables',
      loadComponent:()=>import('./pages/table.component').then(m=>m.TableComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'take-away',
      loadComponent:()=>import('./pages/take-away.component').then(m=>m.TakeAwayComponent),
      data:{dataRoles:['Admin','SuperAdmin','Captain']},
      canActivate: [RoleGuard]
   },{
      path:'home-delivery',
      loadComponent:()=>import('./pages/home-delivery.component').then(m=>m.HomeDeliveryComponent),
      data:{dataRoles:['Admin','SuperAdmin','Captain']},
      canActivate: [RoleGuard]
   },
   {
    path:'order',
    loadComponent:()=>import('./pages/order.component').then(m=>m.OrderComponent),
    data:{dataRoles:['Admin','SuperAdmin','Captain']},
      canActivate: [RoleGuard]
   },
   {
    path:'order/:tableId/:floorId/:typeId',
    loadComponent:()=>import('./pages/order.component').then(m=>m.OrderComponent),
    data:{dataRoles:['Admin','SuperAdmin','Captain']},
      canActivate: [RoleGuard]
   },
   {
    path:'order/:tableId/:floorId/:typeId/:tableName',
    loadComponent:()=>import('./pages/order.component').then(m=>m.OrderComponent),
    data:{dataRoles:['Admin','SuperAdmin','Captain']},
      canActivate: [RoleGuard]
   },{
      path:'open-close-day',
      loadComponent:()=>import('./pages/openclose-day.component').then(m=>m.OpencloseDayComponent),
       data:{dataRoles:['Admin','SuperAdmin','Captain']},
      canActivate: [RoleGuard]
   },
   {
    path:'product',
    loadComponent:()=>import('./pages/product-list.component').then(m=>m.ProductListComponent),
   data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'users',
      loadComponent:()=>import('./pages/users.component').then(m=>m.UsersComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'sales-report',
      loadComponent:()=>import('./pages/sales-report.component').then(m=>m.SalesReportComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'item-wise-report',
      loadComponent:()=>import('./pages/item-wise-report.component').then(m=>m.ItemWiseReportComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'captain-wise-report',
      loadComponent:()=>import('./pages/captain-wise-report.component').then(m=>m.CaptainWiseReportComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'customer-wise-report',
      loadComponent:()=>import('./pages/customer-wise-report.component').then(m=>m.CustomerWiseReportComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'payment-mode-wise-report',
      loadComponent:()=>import('./pages/payment-wise-report.component').then(m=>m.PaymentWiseReportComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'complementary-report',
      loadComponent:()=>import('./pages/complementary-report.component').then(m=>m.ComplementaryReportComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   },{
      path:'tax-wise-report',
      loadComponent:()=>import('./pages/tax-wise-report.component').then(m=>m.TaxWiseReportComponent),
      data:{dataRoles:['Admin','SuperAdmin']},
      canActivate: [RoleGuard]
   }
     ]

  },
   
];
