/**
 * Sheets sollen über der Bildschirmtastatur stehen. Der visuelle Viewport verrät, wie hoch die
 * Tastatur ist; wir geben das als CSS-Variablen weiter (`--kb`, `--vvh`).
 */
export function trackViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement.style;
  const update = () => {
    root.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px');
    root.setProperty('--vvh', vv.height + 'px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}
