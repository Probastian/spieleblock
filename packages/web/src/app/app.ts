import { ChangeDetectionStrategy, Component, inject, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccessService } from './core/api/access.service';
import { Store } from './core/state/store.service';
import { SyncService } from './core/state/sync.service';
import { trackViewport } from './core/ui/viewport';
import { AccessGateComponent } from './shell/access-gate.component';
import { ConfettiCanvasComponent } from './shell/confetti-canvas.component';
import { SheetHostComponent } from './shell/sheet-host.component';
import { ToastHostComponent } from './shell/toast-host.component';

@Component({
  selector: 'sb-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SheetHostComponent, ToastHostComponent, ConfettiCanvasComponent, AccessGateComponent],
  host: { '(document:focusin)': 'typing($event, true)', '(document:focusout)': 'typing($event, false)' },
  template: `
    <router-outlet />
    <sb-sheet-host />
    <sb-toast />
    <sb-confetti />
    @if (access.required()) {
      <sb-access-gate />
    }
  `,
})
export class App {
  protected readonly access = inject(AccessService);

  constructor() {
    const store = inject(Store);
    store.loadCache();
    try {
      void navigator.storage?.persist?.();
    } catch {
      /* nicht unterstützt */
    }
    trackViewport();
    void inject(SyncService).start();
    if (!isDevMode()) registerServiceWorker();
  }

  /** Beim Tippen in ein Eingabefeld wird die untere Leiste ausgeblendet, damit sie nicht über der Tastatur klebt. */
  protected typing(e: Event, focused: boolean): void {
    const el = e.target as HTMLElement | null;
    if (!el?.classList?.contains('pin')) return;
    if (focused) document.body.classList.add('typing');
    else
      setTimeout(() => {
        if (!document.activeElement?.classList.contains('pin')) document.body.classList.remove('typing');
      }, 60);
  }
}

/** Offline-Start: Der Service Worker liefert die zuletzt geladene Fassung, wenn das Netz fehlt (nur mit https oder localhost). */
function registerServiceWorker(): void {
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  }
}
