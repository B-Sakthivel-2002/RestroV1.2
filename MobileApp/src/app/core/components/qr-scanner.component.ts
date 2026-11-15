import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, flashlightOutline } from 'ionicons/icons';

declare const BarcodeDetector: any;

// Full-screen camera that reads one QR code and closes with its text.
// Uses the Android WebView's built-in barcode detector (no extra library).
@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="scan-bar">
        <ion-title>Scan server QR</ion-title>
        <ion-buttons slot="end">
          @if (torchSupported()) {
            <ion-button (click)="toggleTorch()" aria-label="Torch"><ion-icon slot="icon-only" name="flashlight-outline"></ion-icon></ion-button>
          }
          <ion-button (click)="close()" aria-label="Close"><ion-icon slot="icon-only" name="close-outline"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true" class="scan-content">
      <video #video playsinline muted autoplay></video>
      <div class="frame"><span></span></div>
      <p class="hint">{{ message() }}</p>
    </ion-content>
  `,
  styles: [`
    .scan-bar { --background: #000; --color: #fff; }
    .scan-content { --background: #000; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .frame { position: absolute; left: 50%; top: 45%; width: 70vw; max-width: 300px; aspect-ratio: 1; transform: translate(-50%, -50%);
      border-radius: 24px; box-shadow: 0 0 0 100vmax rgba(0,0,0,.55); border: 3px solid rgba(255,255,255,.9); }
    .frame span { position: absolute; left: 8%; right: 8%; height: 2px; top: 50%; background: #4ade80; box-shadow: 0 0 12px #4ade80;
      animation: scan 2s ease-in-out infinite; }
    @keyframes scan { 0%,100% { top: 12%; } 50% { top: 88%; } }
    .hint { position: absolute; left: 24px; right: 24px; bottom: 12%; text-align: center; color: #fff; font-size: 15px; font-weight: 600;
      text-shadow: 0 1px 4px rgba(0,0,0,.6); }
  `],
})
export class QrScannerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video', { static: true }) video!: ElementRef<HTMLVideoElement>;

  private modal = inject(ModalController);
  private zone = inject(NgZone);

  readonly message = signal('Point the camera at the QR code on Settings › Mobile App Connect');
  readonly torchSupported = signal(false);

  private stream?: MediaStream;
  private detector: any;
  private timer: any;
  private torchOn = false;
  private done = false;

  static isSupported(): boolean {
    return typeof BarcodeDetector !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async ngAfterViewInit(): Promise<void> {
    if (!QrScannerComponent.isSupported()) {
      this.message.set('This phone cannot scan QR codes in the app. Close this and type the address instead.');
      return;
    }
    try {
      const formats: string[] = await BarcodeDetector.getSupportedFormats?.() ?? ['qr_code'];
      if (!formats.includes('qr_code')) {
        this.message.set('QR scanning is not available on this phone. Type the address instead.');
        return;
      }
      this.detector = new BarcodeDetector({ formats: ['qr_code'] });
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = this.video.nativeElement;
      v.srcObject = this.stream;
      await v.play();
      const track = this.stream.getVideoTracks()[0];
      const caps: any = track?.getCapabilities?.() ?? {};
      this.torchSupported.set(!!caps.torch);
      // Detection runs outside Angular: no change detection per frame.
      this.zone.runOutsideAngular(() => this.loop());
    } catch (e: any) {
      this.message.set(e?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow it in Android settings, or type the address.'
        : 'Could not open the camera. Type the address instead.');
    }
  }

  private loop(): void {
    this.timer = setTimeout(async () => {
      if (this.done) return;
      try {
        const v = this.video.nativeElement;
        if (v.readyState >= 2) {
          const codes = await this.detector.detect(v);
          const text = codes?.[0]?.rawValue;
          if (text) {
            this.done = true;
            this.zone.run(() => this.close(String(text)));
            return;
          }
        }
      } catch { }
      this.loop();
    }, 180);
  }

  async toggleTorch(): Promise<void> {
    const track: any = this.stream?.getVideoTracks()[0];
    if (!track) return;
    this.torchOn = !this.torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: this.torchOn }] }); } catch { }
  }

  close(text?: string): void {
    this.stop();
    this.modal.dismiss(text ?? null, text ? 'scanned' : 'cancel');
  }

  private stop(): void {
    this.done = true;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  constructor() {
    addIcons({ closeOutline, flashlightOutline });
  }
}
