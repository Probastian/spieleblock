import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';

export interface DialMarker {
  pos: number;
  color: number;
  label: string;
}

const CX = 100;
const CY = 100;
const R = 86;
/** Die Trefferfelder, außen nach innen (Halbbreite in Prozent). Muss zu `wavelength.ZONES` passen. */
const ZONES = [
  { reach: 18, cls: 'wl-z2' },
  { reach: 11, cls: 'wl-z3' },
  { reach: 5, cls: 'wl-z4' },
];

const point = (pos: number, r: number): [number, number] => {
  const a = Math.PI * (1 - pos / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const fmt = (n: number) => n.toFixed(2);

/** Halbkreis-Regler: zeigt optional das Ziel mit Trefferfeldern, die Regler der Spieler und lässt einen Regler ziehen. */
@Component({
  selector: 'sb-wave-dial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="wl-dial"
      [class.edit]="editable()"
      viewBox="0 0 200 112"
      [attr.role]="editable() ? 'slider' : 'img'"
      [attr.tabindex]="editable() ? 0 : null"
      [attr.aria-label]="label()"
      [attr.aria-valuemin]="editable() ? 0 : null"
      [attr.aria-valuemax]="editable() ? 100 : null"
      [attr.aria-valuenow]="editable() ? needle() : null"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up($event)"
      (pointercancel)="up($event)"
      (keydown)="key($event)"
    >
      <path class="wl-arc" d="M14 100A86 86 0 0 1 186 100Z" />
      @if (target() !== null) {
        @for (z of zones(); track z.cls) {
          <path [class]="z.cls" [attr.d]="z.d" />
        }
      }
      @for (m of markersView(); track $index) {
        <g class="wl-mark" [style.--pc]="'var(--p' + m.color + ')'">
          <line [attr.x1]="m.x1" [attr.y1]="m.y1" [attr.x2]="m.x2" [attr.y2]="m.y2" />
          <circle [attr.cx]="m.x1" [attr.cy]="m.y1" r="6" />
          <text [attr.x]="m.x1" [attr.y]="m.ty">{{ m.label }}</text>
        </g>
      }
      @if (needle() !== null) {
        <line class="wl-needle" [attr.x1]="CX" [attr.y1]="CY" [attr.x2]="tip().x" [attr.y2]="tip().y" />
      }
      <circle class="wl-hub" [attr.cx]="CX" [attr.cy]="CY" r="5" />
    </svg>
  `,
})
export class WaveDial {
  /** Geheimes Ziel (0 bis 100); `null` = verborgen. */
  readonly target = input<number | null>(null);
  readonly markers = input<DialMarker[]>([]);
  /** Position des Reglers dieses Spielers. */
  readonly value = input<number | null>(null);
  readonly editable = input(false);
  readonly label = input('Regler zwischen den beiden Polen');
  /** Wird beim Loslassen (oder per Tastatur) gemeldet. */
  readonly valueChange = output<number>();

  protected readonly CX = CX;
  protected readonly CY = CY;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly draft = signal<number | null>(null);
  private dragging = false;

  protected readonly needle = computed(() => this.draft() ?? this.value());
  protected readonly tip = computed(() => {
    const [x, y] = point(this.needle() ?? 50, R - 6);
    return { x: fmt(x), y: fmt(y) };
  });

  protected readonly zones = computed(() => {
    const t = this.target();
    if (t === null) return [];
    return ZONES.map(z => {
      const [ax, ay] = point(Math.max(0, t - z.reach), R);
      const [bx, by] = point(Math.min(100, t + z.reach), R);
      return { cls: z.cls, d: `M${CX} ${CY}L${fmt(ax)} ${fmt(ay)}A${R} ${R} 0 0 1 ${fmt(bx)} ${fmt(by)}Z` };
    });
  });

  protected readonly markersView = computed(() =>
    this.markers().map(m => {
      const [x1, y1] = point(m.pos, R - 24);
      const [x2, y2] = point(m.pos, R);
      return { color: m.color, label: m.label, x1: fmt(x1), y1: fmt(y1), x2: fmt(x2), y2: fmt(y2), ty: fmt(y1 + 2.6) };
    }),
  );

  private posOf(e: PointerEvent): number {
    const svg = this.host.nativeElement.querySelector('svg')!;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 200 - CX;
    const y = CY - ((e.clientY - rect.top) / rect.height) * 112;
    const a = y < 0 ? (x < 0 ? Math.PI : 0) : Math.atan2(y, x);
    return Math.round((1 - a / Math.PI) * 100);
  }

  protected down(e: PointerEvent): void {
    if (!this.editable()) return;
    this.dragging = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this.draft.set(this.posOf(e));
    e.preventDefault();
  }

  protected move(e: PointerEvent): void {
    if (this.dragging) this.draft.set(this.posOf(e));
  }

  protected up(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    const pos = e.type === 'pointercancel' ? this.draft() : this.posOf(e);
    this.draft.set(null);
    if (pos !== null) this.valueChange.emit(pos);
  }

  protected key(e: KeyboardEvent): void {
    if (!this.editable()) return;
    const step = e.shiftKey ? 10 : 2;
    const cur = this.value() ?? 50;
    let next = cur;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    else return;
    e.preventDefault();
    this.valueChange.emit(Math.max(0, Math.min(100, next)));
  }
}
