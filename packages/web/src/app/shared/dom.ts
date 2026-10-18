/** Wert eines Eingabefelds aus einem Ereignis. */
export const inputValue = (e: Event): string => (e.target as HTMLInputElement).value;

/** Nur Ziffern, höchstens `max` Stück. */
export const digitsOnly = (s: string, max = 5): string => s.replace(/\D/g, '').slice(0, max);

export function focusSoon(selector: string): void {
  setTimeout(() => {
    try {
      document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    } catch {
      /* nicht fokussierbar */
    }
  });
}

export const scrollToTop = (smooth = false): void => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: smooth && !reduce ? 'smooth' : 'auto' });
};

export const prefersReducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
