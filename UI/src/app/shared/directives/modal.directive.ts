import { Directive, HostListener, Input } from '@angular/core';

declare var bootstrap: any; // Bootstrap's JavaScript library

@Directive({
  standalone: true,
  selector: '[appModal]'
})
export class ModalDirective {
  @Input('appModal') modalId!: string; // ID of the modal to be triggered

  @HostListener('click') onClick() {
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } else {
      console.error(`Modal with ID "${this.modalId}" not found.`);
    }
  }
}
