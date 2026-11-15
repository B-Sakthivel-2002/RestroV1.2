import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '@applayout/header.component';

// .rp-shell leaves room for the sidebar / icon rail in the side layouts (see src/styles/_shell.scss).
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet,HeaderComponent],
  template: `
  <div class="rp-shell">
    <app-header></app-header>
    <main class="rp-main">
      <router-outlet></router-outlet>
    </main>
  </div>
  `,
  styles: ``
})
export class MainLayoutComponent {



}
