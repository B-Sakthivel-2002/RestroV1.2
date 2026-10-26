import { Injectable } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { AlertPopupComponent } from 'app/shared/component/alert-popup.component';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  constructor(private modalService: BsModalService) {}

  showAlert(title: string, message: string, confirmCallback?: () => void): void {
    const modalRef: BsModalRef = this.modalService.show(AlertPopupComponent, {
      initialState: {
        title,
        message,
        confirmCallback,
      },
    });
  }
}
