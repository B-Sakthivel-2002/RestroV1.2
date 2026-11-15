import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '@appservices/auth.service';
import { ThemeService } from '@appservices/theme.service';
import { AppSettings, isExpressStallType } from '../core/constants/Appsettings';
import { OrderAlertsComponent } from '../shared/component/order-alerts.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, OrderAlertsComponent],
  template: `
    @if (theme.nav() === 'top') {
    <!-- ===== Top bar layout (Classic, Carbon) ===== -->
    <header class="custom-navbar-bg">
      <nav class="navbar navbar-expand-xl">
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
    } @else {
    <!-- ===== Side layouts: full sidebar (Orchid, Midnight) or icon rail (Sunrise) ===== -->
    <aside class="rp-side" [class.open]="drawerOpen" aria-label="Main menu">
      <div class="rp-side-brand">
        <a routerLink="/dashboard" class="rp-side-logo" [title]="branchName || appName">
          <span class="brand-mark"><i class="pi pi-shop"></i></span>
          <span class="rp-side-brand-text">
            <span class="rp-side-brand-title">{{branchName || appName}}</span>
            @if (readOnly) { <span class="rp-side-brand-sub">Online view · read only</span> }
            @else if (branchName) { <span class="rp-side-brand-sub">{{appName}}</span> }
          </span>
        </a>
        @if (theme.nav() === 'side') {
          <button type="button" class="rp-side-collapse" (click)="theme.toggleSideCollapsed(); openGroup = ''"
                  [attr.aria-label]="theme.sideCollapsed() ? 'Expand menu' : 'Collapse menu'"
                  [title]="theme.sideCollapsed() ? 'Expand menu' : 'Collapse menu'">
            <i class="pi" [class.pi-angle-double-left]="!theme.sideCollapsed()" [class.pi-angle-double-right]="theme.sideCollapsed()"></i>
          </button>
        }
      </div>

      <nav class="rp-side-nav">
        <div class="rp-side-label">Menu</div>
        @for (list of menuList; track list.name) {
          @if (list.submenu.length != 0) {
            <button type="button" class="rp-nav-item" [class.current]="activeGroup === list.name" [class.open]="openGroup === list.name"
                    [attr.aria-expanded]="openGroup === list.name" [title]="list.name" (click)="toggleGroup(list.name, $event)">
              <i [class]="list.icon"></i>
              <span class="rp-nav-text">{{list.name}}</span>
              <i class="pi pi-angle-down rp-caret"></i>
            </button>
            @if (openGroup === list.name) {
              <div class="rp-sub" [class.rp-flyout]="flyout" [class.rp-flyout-cols]="flyout && list.submenu.length > 10"
                   [style.top.px]="flyout ? flyTop : null">
                @if (flyout) { <div class="rp-flyout-title">{{list.name}}</div> }
                @for (sub of list.submenu; track sub.name) {
                  @if (sub.name == 'Logout') {
                    <button type="button" class="rp-sub-item" (click)="logout()"><i class="pi pi-sign-out"></i> Logout</button>
                  } @else {
                    <a class="rp-sub-item" [routerLink]="[sub.url]" routerLinkActive="active">{{sub.name}}</a>
                  }
                }
              </div>
            }
          } @else {
            <a class="rp-nav-item" [routerLink]="[list.url]" routerLinkActive="active" [title]="list.name">
              <i [class]="list.icon"></i>
              <span class="rp-nav-text">{{list.name}}</span>
            </a>
          }
        }
      </nav>

      <div class="rp-side-foot">
        <a class="rp-nav-item" routerLink="/settings/theme" routerLinkActive="active" title="Theme">
          <i class="pi pi-palette icon"></i>
          <span class="rp-nav-text">Theme</span>
        </a>
      </div>
    </aside>
    @if (drawerOpen) { <div class="rp-side-backdrop" (click)="drawerOpen = false"></div> }

    <header class="custom-navbar-bg rp-topbar">
      <button type="button" class="rp-burger" (click)="drawerOpen = !drawerOpen" aria-label="Open menu">
        <i class="pi pi-bars"></i>
      </button>
      <div class="rp-topbar-title">
        <span class="rp-topbar-hello">{{greeting}}</span>
        <span class="rp-topbar-date">{{today | date:'EEEE, d MMMM'}}</span>
      </div>
      <app-order-alerts class="ms-auto"></app-order-alerts>
      <div class="rp-user" [title]="role">
        <span class="rp-user-avatar">{{(role || '?').charAt(0)}}</span>
        <span class="rp-user-text">
          <span class="rp-user-name">{{branchName || appName}}</span>
          <span class="rp-user-role">{{role}}</span>
        </span>
      </div>
    </header>
    }
  `,
  styles: ``
})
export class HeaderComponent implements OnInit, OnDestroy {

  imagePath: any;
  menuList: any[] = [];
  appName: string = AppSettings.appName;
  // display only: the branch the user signed in to (stored by AuthService at login)
  branchName: string = localStorage.getItem('branchname') || '';
  // Online server: everything is view only.
  readOnly = false;

  // side layouts
  role = '';
  openGroup = '';      // submenu group shown (accordion in the sidebar, flyout on the rail)
  activeGroup = '';    // group that holds the current page
  drawerOpen = false;  // sidebar as an overlay drawer on tablets / phones
  flyout = false;      // the open group is drawn as a flyout beside the rail
  flyTop = 0;
  today = new Date();
  greeting = '';
  private navSub?: Subscription;

  constructor(
    private queryService: QueryService,
    private auth: AuthService,
    private router: Router,
    public theme: ThemeService
  ) {}

  ngOnInit(): void {
    const role = this.auth.getUserRole();
    this.role = role || '';
    const h = new Date().getHours();
    this.greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

    this.loadMenu(role);

    this.navSub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.drawerOpen = false;
      if (this.flyout) this.openGroup = '';
      this.updateActiveGroup();
    });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  // Sidebar groups open as an accordion; on the icon rail (or a collapsed sidebar) as a flyout
  // beside the clicked icon. Click based, not hover, so it works on touch screens.
  toggleGroup(name: string, ev: MouseEvent) {
    if (this.openGroup === name) { this.openGroup = ''; return; }
    this.flyout = this.isRail();
    if (this.flyout) {
      const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
      const group = this.menuList.find(m => m.name === name);
      const rows = group?.submenu.length > 10 ? Math.ceil(group.submenu.length / 3) : (group?.submenu.length || 1);
      const estimated = rows * 38 + 56;
      this.flyTop = Math.max(8, Math.min(r.top, window.innerHeight - estimated - 8));
    }
    this.openGroup = name;
  }

  // Must match the rail rules in src/styles/_shell.scss.
  private isRail(): boolean {
    if (window.matchMedia('(max-width: 1199.98px)').matches) return false; // drawer shows the full sidebar
    if (this.theme.nav() === 'rail') return true;
    return this.theme.sideCollapsed() || window.matchMedia('(max-width: 1439.98px)').matches;
  }

  private updateActiveGroup() {
    const url = this.router.url.split('?')[0];
    const g = this.menuList.find((m: any) => m.submenu?.some((s: any) => s.url && (url === s.url || url.startsWith(s.url + '/'))));
    this.activeGroup = g ? g.name : '';
    // sidebar accordion: keep the current page's group open
    if (!this.flyout && !this.openGroup && this.activeGroup && !this.isRail()) this.openGroup = this.activeGroup;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (this.flyout && this.openGroup && !(ev.target as HTMLElement)?.closest?.('.rp-side')) this.openGroup = '';
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.drawerOpen = false;
    if (this.flyout) this.openGroup = '';
  }

  loadMenu(type:string) {

    this.queryService.getMenuList(type).subscribe({
      next: (res: any) => {


        if (res.status == 'success') {
          this.menuList = res.menu;
          this.addExpressStallMenu();
          this.applyServerMode();
          this.updateActiveGroup();
        }


      },
      error: (res: any) => {}
    });
  }

  // Online server (view only): just the reports, Sync Status, Theme and Logout. Branch server: Sync Status in Settings.
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
          submenu: [syncItem, ...x.submenu.filter((s: any) => !m.readOnly || s.name === 'Logout' || s.name === 'Theme')]
        });
      this.updateActiveGroup();
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
