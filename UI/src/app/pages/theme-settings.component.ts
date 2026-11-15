import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Density, NavLayout, ThemeDef, ThemeService } from '@appservices/theme.service';

// Settings > Theme. Choosing a card applies it at once to the whole app; the choice is kept on this
// device only (localStorage), so each counter / kitchen screen can have its own look.
@Component({
  selector: 'app-theme-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Theme</h2>
            <p class="sb-tt mb-0">Each theme changes the whole look: colours, font, shapes and where the menu sits.</p>
          </div>
        </div>

        <div class="cnt">
          <div class="ts-grid" role="radiogroup" aria-label="Theme">
            @for (t of theme.themes; track t.id) {
              <button type="button" class="ts-card" role="radio" [attr.aria-checked]="theme.prefs().theme === t.id"
                      [class.selected]="theme.prefs().theme === t.id" (click)="theme.setTheme(t.id)">
                <!-- mini preview drawn in the theme's own colours and layout -->
                <div class="ts-prev" [ngClass]="'nav-' + t.nav" [class.glass]="t.id === 'sunrise'" [ngStyle]="vars(t)">
                  @if (t.nav === 'top') {
                    <div class="ts-top"><i></i><span></span><span></span><span class="on"></span><span></span></div>
                  } @else {
                    <div class="ts-side">
                      <i></i>
                      @for (n of [1,2,3,4,5]; track n) { <span [class.on]="n === 1"></span> }
                    </div>
                  }
                  <div class="ts-body">
                    @if (t.nav !== 'top') { <div class="ts-bar"></div> }
                    <div class="ts-title"></div>
                    <div class="ts-kpis">
                      @for (k of [0,1,2,3]; track k) { <div class="ts-kpi" [ngStyle]="kpi(t, k)"></div> }
                    </div>
                    <div class="ts-panels"><div></div><div></div></div>
                  </div>
                </div>

                <div class="ts-meta">
                  <div class="ts-name">
                    {{t.name}}
                    @if (theme.prefs().theme === t.id) { <span class="ts-check"><i class="pi pi-check"></i></span> }
                  </div>
                  <div class="ts-tag">{{t.tagline}}</div>
                  <div class="ts-chips">
                    <span>{{navLabel(t.nav)}}</span>
                    <span>{{t.font}}</span>
                    @if (t.dark) { <span>Dark</span> }
                    @if (t.id === 'sunrise') { <span>Glass</span> }
                    @if (t.density === 'compact') { <span>Compact</span> }
                  </div>
                </div>
              </button>
            }
          </div>

          <div class="ts-options">
            <div class="ts-opt">
              <div class="ts-opt-head">
                <h3>Menu position</h3>
                <p>{{theme.theme().name}} uses {{navLabel(theme.theme().nav).toLowerCase()}} by default.</p>
              </div>
              <div class="ts-seg" role="radiogroup" aria-label="Menu position">
                @for (o of navOptions; track o.value) {
                  <button type="button" role="radio" [attr.aria-checked]="theme.prefs().nav === o.value"
                          [class.on]="theme.prefs().nav === o.value" (click)="theme.setNav(o.value)">
                    <i [class]="o.icon"></i> {{o.label}}
                  </button>
                }
              </div>
            </div>

            <div class="ts-opt">
              <div class="ts-opt-head">
                <h3>Density</h3>
                <p>Compact fits more tables, orders and rows on small screens.</p>
              </div>
              <div class="ts-seg" role="radiogroup" aria-label="Density">
                @for (o of densityOptions; track o.value) {
                  <button type="button" role="radio" [attr.aria-checked]="theme.prefs().density === o.value"
                          [class.on]="theme.prefs().density === o.value" (click)="theme.setDensity(o.value)">
                    <i [class]="o.icon"></i> {{o.label}}
                  </button>
                }
              </div>
            </div>

            <div class="ts-foot">
              <span><i class="pi pi-desktop"></i> Saved on this device only, so each counter or kitchen screen can have its own look.</span>
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="theme.reset()">Reset to Classic</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  // styles: src/styles/_theme-page.scss (too big for the per-component style budget)
  styles: ``
})
export class ThemeSettingsComponent {
  navOptions: { value: NavLayout | 'auto'; label: string; icon: string }[] = [
    { value: 'auto', label: 'Theme default', icon: 'pi pi-sparkles' },
    { value: 'top', label: 'Top bar', icon: 'pi pi-window-maximize' },
    { value: 'side', label: 'Sidebar', icon: 'pi pi-align-left' },
    { value: 'rail', label: 'Icon rail', icon: 'pi pi-th-large' }
  ];
  densityOptions: { value: Density | 'auto'; label: string; icon: string }[] = [
    { value: 'auto', label: 'Theme default', icon: 'pi pi-sparkles' },
    { value: 'comfortable', label: 'Comfortable', icon: 'pi pi-expand' },
    { value: 'compact', label: 'Compact', icon: 'pi pi-compress' }
  ];

  constructor(public theme: ThemeService) {}

  navLabel(n: NavLayout): string {
    return n === 'top' ? 'Top bar' : n === 'side' ? 'Sidebar' : 'Icon rail';
  }

  vars(t: ThemeDef) {
    const p = t.preview;
    return { '--p-bg': p.bg, '--p-surface': p.surface, '--p-nav': p.nav, '--p-navtext': p.navText,
             '--p-primary': p.primary, '--p-text': p.text };
  }

  // KPI swatches echo each theme's summary cards
  kpi(t: ThemeDef, i: number) {
    const sets: Record<string, string[]> = {
      classic: [`linear-gradient(135deg, ${t.preview.primary}, ${t.preview.accent})`],
      orchid: ['linear-gradient(160deg,#2e0a6b,#8b5cf6)', 'linear-gradient(150deg,#9d4edd,#c77dff)', 'linear-gradient(150deg,#8b5cf6,#b794f6)', 'linear-gradient(150deg,#b06ef3,#d8b4fe)'],
      sunrise: ['linear-gradient(145deg,#ff8f45,#e2550c)', '#2b2118'],
      midnight: ['#22208a', '#f0146d', '#8b2be2', '#ffad2a'],
      carbon: ['linear-gradient(135deg,#0f766e,#155e75)']
    };
    const s = sets[t.id] || [];
    return s[i] ? { background: s[i] } : {};
  }
}
