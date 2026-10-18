/** Berechnung der Liniendiagramme: reine Funktionen ohne Angular, damit sie sich testen lassen. */

export interface ChartSeries {
  name: string;
  /** CSS-Farbe, z. B. `var(--c2)`. */
  color: string;
  /** Index der Markierungsform (damit Linien auch ohne Farbe unterscheidbar sind). */
  mk: number;
  /** [x, y] */
  pts: [number, number][];
}

export interface ChartConfig {
  id: string;
  title?: string;
  series: ChartSeries[];
  /** Nulllinie immer zeigen. */
  zero?: boolean;
  /** Namen direkt an die Linienenden schreiben (bis vier Linien). */
  direct?: boolean;
  xTitle?: string;
  h?: number;
  xmin?: number;
  xmax?: number;
  head?: (x: number) => string;
  xlab?: (x: number) => string;
  table?: { head: string[]; rows: string[][] };
  aria?: string;
  note?: string;
  legend?: boolean;
}

export type MarkShape = { kind: 'circle'; cx: number; cy: number; r: number } | { kind: 'poly'; points: string };

export interface ChartModel {
  W: number;
  H: number;
  /** Plotbereich */
  left: number;
  right: number;
  top: number;
  bottom: number;
  yTicks: { y: number; label: string; zero: boolean }[];
  xTicks: { x: number; label: string }[];
  lines: { d: string; color: string }[];
  marks: { shape: MarkShape; color: string }[];
  labels: { x: number; y: number; text: string }[];
  xs: number[];
  xAt(value: number): number;
  yAt(value: number): number;
  /** Werte aller Linien an der Stelle `x`, größte zuerst. */
  rowsAt(x: number): { series: ChartSeries; value: number; y: number }[];
}

export const formatNumber = (v: number): string => (v < 0 ? '−' + Math.abs(v) : String(v));
export const shortLabel = (s: string): string => (s.length > 8 ? s.slice(0, 7) + '…' : s);

/** Runde Achsenwerte: 0, 25, 50 … statt 0, 23.7, 47.4 … */
export function niceTicks(lo: number, hi: number, want = 4): number[] {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / want;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / mag;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Form der Markierung je Index: Kreis, Vierecke, Dreiecke … */
const MARKS: (['c'] | ['p', number, number, number] | ['x'])[] = [['c'], ['p', 4, 45, 1.38], ['p', 3, -90, 1.4], ['p', 4, 0, 1.5], ['p', 3, 90, 1.4], ['p', 5, -90, 1.22], ['p', 6, 0, 1.2], ['x']];

export function markShape(k: number, cx: number, cy: number, r: number): MarkShape {
  const s = MARKS[((k % 8) + 8) % 8]!;
  if (s[0] === 'c') return { kind: 'circle', cx, cy, r };
  const pt = (x: number, y: number) => `${(cx + x).toFixed(1)},${(cy + y).toFixed(1)}`;
  if (s[0] === 'x') {
    const a = r * 0.45;
    const b = r * 1.2;
    const pts: [number, number][] = [[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]];
    return { kind: 'poly', points: pts.map(([x, y]) => pt(x, y)).join(' ') };
  }
  const [, n, rot, scale] = s;
  const rr = r * scale;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    pts.push(pt(rr * Math.cos(a), rr * Math.sin(a)));
  }
  return { kind: 'poly', points: pts.join(' ') };
}

const W = 340;
const round1 = (v: number) => Math.round(v * 10) / 10;

export function buildChart(c: ChartConfig): ChartModel | null {
  const all = c.series.flatMap(s => s.pts);
  if (!all.length) return null;

  const H = c.h ?? 236;
  const direct = !!c.direct && c.series.length > 1 && c.series.length <= 4;
  const ml = 38;
  const mt = 14;
  const mb = c.xTitle ? 40 : 28;
  const mr = direct ? 60 : 16;
  const pw = W - ml - mr;
  const ph = H - mt - mb;

  const xs = [...new Set(all.map(p => p[0]))].sort((a, b) => a - b);
  const xmin = c.xmin ?? xs[0]!;
  const xmax = Math.max(c.xmax ?? xs[xs.length - 1]!, xmin + 1);
  let lo = Math.min(...all.map(p => p[1]));
  let hi = Math.max(...all.map(p => p[1]));
  if (c.zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const ticks = niceTicks(lo, hi, 4);
  const ymin = ticks[0]!;
  const ymax = ticks[ticks.length - 1]!;
  const xAt = (v: number) => ml + ((v - xmin) / (xmax - xmin)) * pw;
  const yAt = (v: number) => mt + (1 - (v - ymin) / (ymax - ymin)) * ph;

  const yTicks = ticks.map(v => ({ y: round1(yAt(v)), label: formatNumber(v), zero: !!c.zero && v === 0 }));
  const stepX = Math.max(1, Math.ceil((xmax - xmin) / 7));
  const xTicks: ChartModel['xTicks'] = [];
  for (let v = Math.ceil(xmin); v <= xmax + 1e-9; v += stepX) xTicks.push({ x: round1(xAt(v)), label: c.xlab ? c.xlab(v) : String(v) });

  const lines: ChartModel['lines'] = [];
  const marks: ChartModel['marks'] = [];
  for (const s of c.series) {
    if (!s.pts.length) continue;
    lines.push({ color: s.color, d: s.pts.map((p, i) => (i ? 'L' : 'M') + round1(xAt(p[0])) + ' ' + round1(yAt(p[1]))).join('') });
    const shown = s.pts.length <= 14 ? s.pts : [s.pts[s.pts.length - 1]!];
    for (const p of shown) marks.push({ color: s.color, shape: markShape(s.mk, round1(xAt(p[0])), round1(yAt(p[1])), 4.5) });
  }

  const labels: ChartModel['labels'] = [];
  if (direct) {
    const rows = c.series
      .filter(s => s.pts.length)
      .map(s => {
        const p = s.pts[s.pts.length - 1]!;
        return { s, x: xAt(p[0]), y: yAt(p[1]), ly: 0 };
      })
      .sort((a, b) => a.y - b.y);
    rows.forEach((r, i) => (r.ly = i ? Math.max(r.y, rows[i - 1]!.ly + 15) : r.y));
    const maxY = mt + ph;
    const last = rows[rows.length - 1];
    if (last && last.ly > maxY) {
      last.ly = maxY;
      for (let i = rows.length - 2; i >= 0; i--) rows[i]!.ly = Math.min(rows[i]!.ly, rows[i + 1]!.ly - 15);
    }
    for (const r of rows) labels.push({ x: round1(r.x + 10), y: round1(r.ly + 4.5), text: shortLabel(r.s.name) });
  }

  return {
    W,
    H,
    left: ml,
    right: W - mr,
    top: mt,
    bottom: mt + ph,
    yTicks,
    xTicks,
    lines,
    marks,
    labels,
    xs,
    xAt,
    yAt,
    rowsAt: x =>
      c.series
        .map(series => ({ series, p: series.pts.find(p => p[0] === x) }))
        .filter((r): r is { series: ChartSeries; p: [number, number] } => !!r.p)
        .map(r => ({ series: r.series, value: r.p[1], y: yAt(r.p[1]) }))
        .sort((a, b) => b.value - a.value),
  };
}

/** Linienverlauf aus kumulierten Werten: `cum[i] = [0, nach Runde 1, …]`. */
export function roundsChartConfig(id: string, title: string, players: { name: string; color: number }[], cum: number[][]): ChartConfig | null {
  const n = (cum[0]?.length ?? 1) - 1;
  if (n < 1) return null;
  const series: ChartSeries[] = players.map((p, i) => ({ name: p.name, color: `var(--c${p.color})`, mk: p.color, pts: cum[i]!.map((v, k): [number, number] => [k, v]) }));
  const best = Math.max(...cum.map(c => c[n]!));
  const lead = players.filter((_, i) => cum[i]![n] === best).map(p => p.name).join(' und ');
  return {
    id,
    title,
    series,
    zero: true,
    direct: true,
    xTitle: 'Runde',
    h: 236,
    head: x => (x ? `Nach Runde ${x}` : 'Start'),
    xlab: v => String(v),
    table: { head: ['Runde', ...players.map(p => p.name)], rows: cum[0]!.map((_, k) => [k ? String(k) : 'Start', ...cum.map(c => formatNumber(c[k]!))]) },
    aria: `Liniendiagramm: Punktestand nach jeder der ${n} Runden. Vorne liegt ${lead} mit ${formatNumber(best)} Punkten.`,
  };
}
