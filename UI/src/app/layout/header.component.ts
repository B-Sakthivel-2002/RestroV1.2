import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@appservices/auth.service';
import { AppSettings } from '../core/constants/Appsettings';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="custom-navbar-bg">
      <nav class="navbar navbar-expand-xl bg-white">
        <div class="container-fluid">

          <div class="custom-brand">
            <a class="navbar-brand" routerLink="/dashboard"><span class="brand-mark"><i class="pi pi-shop"></i></span>{{appName}}</a>
          </div>

          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navSupportLogoId" aria-controls="navSupportLogoId" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>

          <div class="collapse navbar-collapse justify-content-end" id="navSupportLogoId">
            @if (branchName) {
              <span class="hdr-branch" title="Current branch"><i class="pi pi-building"></i>{{branchName}}</span>
            }
            <ul class="navbar-nav">

              @for(list of menuList; track list.name) {

                @if(list.submenu.length != 0) {
                  <li class="nav-item dropdown" routerLinkActive="current">
                    <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                      <span class="sb-tt">{{list.name}}</span>
                      <i [class]="list.icon"></i>
                    </a>

                    <ul class="dropdown-menu dropdown-menu-end">
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
        }

        
      },
      error: (res: any) => {}
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