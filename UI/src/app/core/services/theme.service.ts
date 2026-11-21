import { Injectable, signal, computed } from '@angular/core';

/* Themes are full looks, not colour swaps: each one sets its own palette, font, corner shape,
   surface style (flat / glass), navigation layout and density. The CSS for every theme lives in
   src/styles/_themes.scss and src/styles/_shell.scss, keyed off attributes on <html>:
     data-theme    which theme's tokens and component styles apply
     data-nav      top | side | rail   (the theme's default unless the user overrides it)
     data-density  comfortable | compact
     data-bs-theme light | dark        (Bootstrap's own dark mode for its components)
   The choice is saved per device (POS terminals are shared by staff), in localStorage. */

export type NavLayout = 'top' | 'side' | 'rail';
export type Density = 'comfortable' | 'compact';

export interface ThemeDef {
  id: string;
  name: string;
  tagline: string;
  dark: boolean;
  nav: NavLayout;
  density: Density;
  font: string;
  // preview swatches for the picker: page bg, surface, nav, primary, accent
  preview: { bg: string; surface: string; nav: string; navText: string; primary: string; accent: string; text: string };
  metaColor: string; // browser / tablet status-bar colour
}

export interface ThemePrefs {
  theme: string;
  nav: NavLayout | 'auto';
  density: Density | 'auto';
}

export const THEMES: ThemeDef[] = [
  {
    id: 'classic', name: 'Classic', tagline: 'Clean blue, menu across the top', dark: false,
    nav: 'top', density: 'comfortable', font: 'Poppins',
    preview: { bg: '#f3f5f9', surface: '#ffffff', nav: '#ffffff', navText: '#6b7280', primary: '#4361ee', accent: '#3a0ca3', text: '#1f2937' },
    metaColor: '#4361ee'
  },
  {
    id: 'orchid', name: 'Orchid', tagline: 'Ocean blue gradients, rounded cards, side menu', dark: false,
    nav: 'side', density: 'comfortable', font: 'Plus Jakarta Sans',
    preview: { bg: '#e3edf3', surface: '#f5fafd', nav: '#f5fafd', navText: '#4a667c', primary: '#0077b6', accent: '#03045e', text: '#0b1f3a' },
    metaColor: '#0077b6'
  },
  {
    id: 'midnight', name: 'Midnight', tagline: 'Navy sidebar, colourful KPI cards', dark: false,
    nav: 'side', density: 'comfortable', font: 'Poppins',
    preview: { bg: '#f4f5fb', surface: '#ffffff', nav: '#1e1b6e', navText: '#c7c6f0', primary: '#8b2be2', accent: '#ff1f7a', text: '#1b1a3a' },
    metaColor: '#1e1b6e'
  },
  {
    id: 'carbon', name: 'Carbon', tagline: 'Dark and compact, easy on the eyes at night', dark: true,
    nav: 'top', density: 'compact', font: 'Inter',
    preview: { bg: '#0d1117', surface: '#161b22', nav: '#161b22', navText: '#9aa4b2', primary: '#2dd4bf', accent: '#38bdf8', text: '#e6edf3' },
    metaColor: '#0d1117'
  }
];

const STORAGE_KEY = 'rp-theme';
const DEFAULT_PREFS: ThemePrefs = { theme: 'classic', nav: 'auto', density: 'auto' };

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes = THEMES;
  readonly prefs = signal<ThemePrefs>(ThemeService.load());
  readonly theme = computed(() => this.find(this.prefs().theme));
  readonly nav = computed<NavLayout>(() => this.prefs().nav === 'auto' ? this.theme().nav : this.prefs().nav as NavLayout);
  readonly density = computed<Density>(() => this.prefs().density === 'auto' ? this.theme().density : this.prefs().density as Density);
  // full sidebar folded down to the icon rail (sidebar layout only), remembered per device
  readonly sideCollapsed = signal<boolean>(ThemeService.read('rp-side-collapsed') === '1');

  constructor() {
    this.apply();
  }

  find(id: string): ThemeDef {
    return THEMES.find(t => t.id === id) || THEMES[0];
  }

  setTheme(id: string) { this.update({ theme: this.find(id).id }); }
  setNav(nav: NavLayout | 'auto') { this.update({ nav }); }
  setDensity(density: Density | 'auto') { this.update({ density }); }
  reset() { this.update({ ...DEFAULT_PREFS }); }

  toggleSideCollapsed() {
    this.sideCollapsed.set(!this.sideCollapsed());
    ThemeService.write('rp-side-collapsed', this.sideCollapsed() ? '1' : '0');
    this.apply();
  }

  private update(p: Partial<ThemePrefs>) {
    this.prefs.set({ ...this.prefs(), ...p });
    ThemeService.write(STORAGE_KEY, JSON.stringify(this.prefs()));
    this.apply();
  }

  // Sets the attributes the stylesheets key off. index.html runs the same logic before Angular
  // starts so the first paint is already in the saved theme.
  apply() {
    const root = document.documentElement;
    const t = this.theme();
    root.setAttribute('data-theme', t.id);
    root.setAttribute('data-nav', this.nav());
    root.setAttribute('data-density', this.density());
    root.setAttribute('data-bs-theme', t.dark ? 'dark' : 'light');
    root.toggleAttribute('data-side-collapsed', this.nav() === 'side' && this.sideCollapsed());
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.metaColor);
  }

  private static load(): ThemePrefs {
    try {
      const raw = ThemeService.read(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const p = JSON.parse(raw);
      return {
        theme: THEMES.some(t => t.id === p.theme) ? p.theme : DEFAULT_PREFS.theme,
        nav: ['auto', 'top', 'side', 'rail'].includes(p.nav) ? p.nav : 'auto',
        density: ['auto', 'comfortable', 'compact'].includes(p.density) ? p.density : 'auto'
      };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  private static read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  private static write(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* private mode: theme just isn't remembered */ }
  }
}
