import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex justify-content-center align-items-center loading" *ngIf="isLoading" style="height: 100vh;">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `,
  styles: `
  .loading{
    height: 100%;
  position: fixed;
  z-index: 1000;
  width: 100%;
  background: rgba(0,0,0,0.4);
  }
  .loading .spinner-border{
    color: #fff;
  }
  `
})
export class LoaderComponent {
  @Input() isLoading: boolean  = false;
}
