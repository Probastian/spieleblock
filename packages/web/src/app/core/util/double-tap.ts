import { signal } from '@angular/core';

/**
 * Sicherheitsabfrage ohne Dialog: Das erste Tippen „scharf“ den Knopf, ein zweites innerhalb von
 * `windowMs` löst die Aktion aus. Der Knopf zeigt solange `armed()` einen Hinweistext.
 */
export function doubleTap(windowMs = 4000) {
  const armed = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    armed: armed.asReadonly(),
    /** `true`, wenn die Aktion jetzt ausgeführt werden soll. */
    tap(): boolean {
      if (armed()) {
        clearTimeout(timer);
        armed.set(false);
        return true;
      }
      armed.set(true);
      clearTimeout(timer);
      timer = setTimeout(() => armed.set(false), windowMs);
      return false;
    },
    reset(): void {
      clearTimeout(timer);
      armed.set(false);
    },
  };
}
