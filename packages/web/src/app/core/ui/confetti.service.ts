import { Injectable, signal } from '@angular/core';

const DURATION_MS = 3400;
const PIECES = 150;

/** Konfetti nach dem Spielende. Die Zeichenfläche liefert `ConfettiCanvas`. */
@Injectable({ providedIn: 'root' })
export class ConfettiService {
  readonly canvas = signal<HTMLCanvasElement | null>(null);
  private readonly reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  fire(): void {
    const canvas = this.canvas();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || this.reduceMotion) return;

    const W = innerWidth;
    const H = innerHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const style = getComputedStyle(document.documentElement);
    const colors = [0, 1, 2, 3, 4, 5, 6].map(k => style.getPropertyValue('--p' + k).trim() || '#D62839');
    const pieces = Array.from({ length: PIECES }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.5,
      y: H * 0.3,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 12 - 5,
      size: 5 + Math.random() * 6,
      angle: Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.35,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      square: Math.random() < 0.25,
    }));

    canvas.classList.add('on');
    const start = performance.now();
    let last = start;
    const step = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.7);
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (const p of pieces) {
        p.vy += 0.3 * dt;
        p.vx *= 0.992;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.square) {
          ctx.beginPath();
          ctx.roundRect(-p.size / 2, -p.size / 2, p.size, p.size, 2);
          ctx.fill();
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (now - start < DURATION_MS) requestAnimationFrame(step);
      else {
        ctx.clearRect(0, 0, W, H);
        canvas.classList.remove('on');
      }
    };
    requestAnimationFrame(step);
  }
}
