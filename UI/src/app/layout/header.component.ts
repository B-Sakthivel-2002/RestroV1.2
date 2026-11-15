import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@appservices/auth.service';
import { AppSettings, isExpressStallType } from '../core/constants/Appsettings';
import { OrderAlertsComponent } from '../shared/component/order-alerts.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, OrderAlertsComponent],
  template: `
    <header class="custom-navbar-bg">
      <nav class="navbar navbar-expand-xl bg-white">
        <div class="container-fluid">

          <div class="custom-brand">
            <a class="navbar-brand" routerLink="/dashboard">
              <span class="brand-mark"><i class="pi pi-shop"></i></span>
              <span class="brand-text">
                <span class="brand-title">{{branchName || appName}}</span>
                @if (readOnly) { <span class="brand-sub">Online view · read only</span> }
                @else if (branchName) { <span class="brand-sub">{{appName}}</span> }
              </span>
            </a>
          </div>

          <!-- Reorder / cancel / ready-to-serve / delay alerts (live). Right of the menu on wide screens. -->
          <app-order-alerts class="ms-auto me-2 order-xl-last"></app-order-alerts>

          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navSupportLogoId" aria-controls="navSupportLogoId" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>

          <div class="collapse navbar-collapse justify-content-end" id="navSupportLogoId">
            <ul class="navbar-nav">

              @for(list of menuList; track list.name) {

                @if(list.submenu.length != 0) {
                  <li class="nav-item dropdown" routerLinkActive="current">
                    <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                      <span class="sb-tt">{{list.name}}</span>
                      <i [class]="list.icon"></i>
                    </a>

                    <ul class="dropdown-menu dropdown-menu-end" [class.menu-cols]="list.submenu.length > 10">
                      @for(sublist of list.submenu; track sublist.name) {
                        @if(sublist.name == 'Logout') {
                          <li>
                            <span class="dropdown-item" (click)="logout()" style="cursor:pointer;">
                              {{sublist.name}}
                            </span>
                          </li>
                        } @else {
                          <li>
                            <a class="dropdown-item" [routerLink]="[sublist.url]" routerLinkActive="active">
                              {{sublist.name}}
                            </a>
                          </li>
                        }
                      }
                    </ul>
                  </li>
                } @else {
                  <li class="nav-item">
                    <a class="nav-link" [routerLink]="[list.url]" routerLinkActive="active">
                      <i [class]="list.icon"></i>
                      <span>{{list.name}}</span>
                    </a>
                  </li>
                }

              }

            </ul>
          </div>

        </div>
      </nav>
    </header>
  `,
  styles: ``
})
export class HeaderComponent implements OnInit {

  imagePath: any;
  menuList: any[] = [];
  appName: string = AppSettings.appName;
  // display only: the branch the user signed in to (stored by AuthService at login)
  branchName: string = localStorage.getItem('branchname') || '';
  // Online server: everything is view only.
  readOnly = false;

  constructor(
    private queryService: QueryService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = this.auth.getUserRole();
    
    this.loadMenu(role);     
  }

  loadMenu(type:string) {

    this.queryService.getMenuList(type).subscribe({
      next: (res: any) => {
        

        if (res.status == 'success') {
          this.menuList = res.menu;
          this.addExpressStallMenu();
          this.applyServerMode();
        }

        
      },
      error: (res: any) => {}
    });
  }

  // Online server (view only): just the reports, Sync Status and Logout. Branch server: Sync Status in Settings.
  // The menu constants are shared, so the lists are copied, never changed in place.
  applyServerMode() {
    this.queryService.getServerMode().subscribe((m) => {
      if (m.mode === 'Standalone') return;
      this.readOnly = m.readOnly;
      const syncItem = { name: 'Sync Status', url: '/settings/sync', icon: 'preferences' };
      this.menuList = this.menuList
        .filter((x: any) => !m.readOnly || x.name === 'Report' || x.name === 'Settings')
        .map((x: any) => x.name !== 'Settings' ? x : {
          ...x,
          submenu: [syncItem, ...x.submenu.filter((s: any) => !m.readOnly || s.name === 'Logout')]
        });
    });
  }

  // Shown next to Take away only when the user's branch has Express Stall switched on.
  addExpressStallMenu() {
    if (this.menuList.findIndex((m: any) => m.name === 'Take away') < 0) return;
    this.queryService.getOrderTypes().subscribe({
      next: (res: any) => {
        const stall = res.expressStall ? (res.data || []).find((ot: any) => isExpressStallType(ot)) : null;
        // Looked up again: the online view may have removed Take away meanwhile.
        const takeAway = this.menuList.findIndex((m: any) => m.name === 'Take away');
        if (!stall || takeAway < 0 || this.menuList.some((m: any) => m.name === 'Express Stall')) return;
        this.menuList = [
          ...this.menuList.slice(0, takeAway + 1),
          { name: 'Express Stall', url: '/order/0/0/' + stall.ordertypeid, icon: 'pi pi-bolt icon', submenu: [] },
          ...this.menuList.slice(takeAway + 1)
        ];
      },
      error: () => {}
    });
  }

  logout() {
    this.auth.clearRolesToken().subscribe({
      next: (res: any) => {
        if (res) {
          this.router.navigate(['/']);
        }
      },
      error: (err: any) => {}
    });
  }
}