import { Injectable, effect, inject, signal } from '@angular/core';
import { Store } from '../state/store.service';
import { ToastService } from './toast.service';

/** Hält das Display während des Spiels an, wenn der Nutzer das eingeschaltet hat. */
@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private readonly store = inject(Store);
  private readonly toast = inject(ToastService);
  private lock: WakeLockSentinel | null = null;
  /** Die Spielansicht ist offen (nur dort soll das Display wach bleiben). */
  readonly inGame = signal(false);

  constructor() {
    effect(() => {
      const wanted = this.store.meta().settings.wake && this.inGame();
      void this.apply(wanted, false);
    });
    document.addEventListener('visibilitychange', () => void this.apply(this.store.meta().settings.wake && this.inGame(), false));
  }

  async toggle(): Promise<void> {
    const on = !this.store.meta().settings.wake;
    this.store.setWake(on);
    await this.apply(on && this.inGame(), true);
  }

  private async apply(wanted: boolean, byUser: boolean): Promise<void> {
    try {
      if (wanted && document.visibilityState === 'visible') {
        if (!this.lock && navigator.wakeLock) {
          this.lock = await navigator.wakeLock.request('screen');
          this.lock.addEventListener('release', () => (this.lock = null));
          if (byUser) this.toast.show('Bildschirm bleibt an');
        } else if (!navigator.wakeLock && byUser) this.toast.show('Dieses Gerät erlaubt das hier leider nicht');
      } else if (this.lock) {
        await this.lock.release();
        this.lock = null;
      }
    } catch {
      this.lock = null;
      if (byUser) this.toast.show('Display-Sperre lässt sich hier nicht verhindern');
    }
  }
}
