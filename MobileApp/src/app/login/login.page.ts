import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline, lockClosedOutline, personOutline, restaurant, serverOutline, swapHorizontalOutline } from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
import { ApiConfigService } from '../core/services/api-config.service';
import { apiError } from '../core/guards/auth-interceptor.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner, FormsModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly api = inject(ApiConfigService);

  username = '';
  password = '';
  showPassword = false;
  submitted = false;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  constructor() {
    addIcons({ eyeOffOutline, eyeOutline, lockClosedOutline, personOutline, restaurant, serverOutline, swapHorizontalOutline });
  }

  ngOnInit(): void {
    this.notice.set(this.auth.takeLogoutReason());
    try { this.username = localStorage.getItem('lastUsername') || ''; } catch { }
  }

  async login(): Promise<void> {
    this.submitted = true;
    this.error.set('');
    if (!this.username.trim() || !this.password) return;
    this.busy.set(true);
    try {
      const res = await this.auth.login(this.username, this.password);
      if (!res.ok) {
        this.error.set(res.message || 'Invalid username or password');
        return;
      }
      try { localStorage.setItem('lastUsername', this.username.trim()); } catch { }
      this.password = '';
      this.notice.set('');
      await this.router.navigateByUrl(this.auth.homeUrl(), { replaceUrl: true });
    } catch (err: any) {
      this.error.set(apiError(err, 'Login failed. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  changeServer(): void {
    this.router.navigateByUrl('/connect');
  }
}
