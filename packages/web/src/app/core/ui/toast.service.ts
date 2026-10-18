import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  text: string;
  undo?: () => void;
}

const SHORT_MS = 2400;
const UNDO_MS = 4000;

/** Kurze Meldung oben am Bildschirm, optional mit „Rückgängig“. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<ToastMessage>({ text: '' });
  readonly visible = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(text: string, undo?: () => void): void {
    this.message.set({ text, undo });
    this.visible.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.visible.set(false), undo ? UNDO_MS : SHORT_MS);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.visible.set(false);
  }

  runUndo(): void {
    const undo = this.message().undo;
    this.dismiss();
    undo?.();
  }
}
