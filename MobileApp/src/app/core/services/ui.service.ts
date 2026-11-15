import { Injectable, inject } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Toasts, confirms and haptic feedback, the same look on every screen.
@Injectable({ providedIn: 'root' })
export class UiService {
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private lastToast?: HTMLIonToastElement;

  async toast(message: string, kind: 'success' | 'error' | 'info' = 'info', ms = 2200): Promise<void> {
    if (kind === 'success') this.notify(NotificationType.Success);
    if (kind === 'error') this.notify(NotificationType.Error);
    this.lastToast?.dismiss().catch(() => { });
    const toast = await this.toastCtrl.create({
      message,
      duration: kind === 'error' ? Math.max(ms, 3500) : ms,
      position: 'top',
      cssClass: 'app-toast app-toast-' + kind,
      icon: kind === 'success' ? 'checkmark-circle' : kind === 'error' ? 'alert-circle' : 'information-circle',
      buttons: kind === 'error' ? [{ icon: 'close', role: 'cancel' }] : undefined,
    });
    this.lastToast = toast;
    await toast.present();
  }

  async alert(header: string, message: string): Promise<void> {
    const a = await this.alertCtrl.create({ header, message, buttons: ['OK'], cssClass: 'app-alert' });
    await a.present();
    await a.onDidDismiss();
  }

  async confirm(header: string, message: string, okText = 'OK', destructive = false): Promise<boolean> {
    const a = await this.alertCtrl.create({
      header,
      message,
      cssClass: 'app-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: okText, role: 'confirm', cssClass: destructive ? 'alert-danger' : '' },
      ],
    });
    await a.present();
    const { role } = await a.onDidDismiss();
    return role === 'confirm';
  }

  /** Asks for a reason / note; null when cancelled. */
  async prompt(header: string, placeholder: string, okText = 'OK', required = true): Promise<string | null> {
    const a = await this.alertCtrl.create({
      header,
      cssClass: 'app-alert',
      inputs: [{ name: 'text', type: 'textarea', placeholder }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: okText, role: 'confirm',
          handler: (v: any) => !required || !!String(v?.text ?? '').trim(),
        },
      ],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    return role === 'confirm' ? String(data?.values?.text ?? '').trim() : null;
  }

  tap(): void {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
  }

  private notify(type: NotificationType): void {
    Haptics.notification({ type }).catch(() => { });
  }
}
