import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-discount-modal',
  templateUrl: './discount-modal.component.html',
  styleUrls: ['./discount-modal.component.scss'],
    standalone: true,
  imports: [IonicModule, FormsModule],
})
export class DiscountModalComponent  implements OnInit {


  ngOnInit() {}

  selected: any;

  constructor(private modalCtrl: ModalController) {}

  close() {
    this.modalCtrl.dismiss();
  }

  apply() {
    this.modalCtrl.dismiss(this.selected);
  }

}
