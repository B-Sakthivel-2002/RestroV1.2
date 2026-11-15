import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class AlertService {

  constructor(private alertCtrl: AlertController) {}

  async showAlert(
    title: string,
    message: string,
    confirmCallback?: () => void
  ) {
    const alert = await this.alertCtrl.create({
      header: title,
      message: message,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'OK',
          handler: () => {
            if (confirmCallback) {
              confirmCallback(); // ✅ same as your old logic
            }
          }
        }
      ]
    });

    await alert.present();
  }
}