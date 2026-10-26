import { Component } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-alert-popup',
  standalone: true,
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{ title }}</h4>
      <button type="button" class="btn-close" aria-label="Close" (click)="onClose()"></button>
    </div>
    <div class="modal-body">
      <p>{{ message }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-primary" (click)="onConfirm()">OK</button>
      <button type="button" class="btn btn-secondary" (click)="onClose()">Cancel</button>
    </div>
  `,
  styles: [
    `
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    `,
  ],
})
export class AlertPopupComponent {
  title: string = '';
  message: string = '';
  confirmCallback?: () => void;

  constructor(public bsModalRef: BsModalRef) {}

  onConfirm(): void {
    if (this.confirmCallback) {
      this.confirmCallback();
    }
    this.bsModalRef.hide();
  }

  onClose(): void {
    this.bsModalRef.hide();
  }
}
