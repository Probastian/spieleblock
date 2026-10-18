import { Injectable, InjectionToken, Injector, Type, inject, signal } from '@angular/core';

/** Daten, die beim Öffnen eines Sheets mitgegeben wurden. */
export const SHEET_DATA = new InjectionToken<unknown>('SHEET_DATA');

export interface ActiveSheet {
  component: Type<unknown>;
  tall: boolean;
  injector: Injector;
}

export interface SheetOptions<D> {
  /** Füllt fast den ganzen Bildschirm. */
  tall?: boolean;
  data?: D;
}

/**
 * Das von unten einfahrende Blatt (Dialog). Es gibt immer höchstens eins; öffnet ein Sheet ein
 * anderes, wird es ersetzt. Der Inhalt ist eine gewöhnliche Komponente, die `SHEET_DATA` injizieren kann.
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly parent = inject(Injector);
  readonly active = signal<ActiveSheet | null>(null);
  private lastFocus: Element | null = null;

  open<D>(component: Type<unknown>, options: SheetOptions<D> = {}): void {
    if (!this.active()) this.lastFocus = document.activeElement;
    const injector = Injector.create({ providers: [{ provide: SHEET_DATA, useValue: options.data }], parent: this.parent });
    this.active.set({ component, tall: !!options.tall, injector });
    document.body.classList.add('sheet-open');
  }

  close(): void {
    if (!this.active()) return;
    this.active.set(null);
    document.body.classList.remove('sheet-open');
    const el = this.lastFocus as HTMLElement | null;
    if (el && document.contains(el)) {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* Element nicht fokussierbar */
      }
    }
  }
}
