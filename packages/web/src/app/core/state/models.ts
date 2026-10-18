import { ENGINES, clone, isId, num } from '@spieleblock/games';

export const PLAYER_COLORS = 8;
export const MAX_NAME_LENGTH = 16;

/** Ein Mitspieler in der Spielerliste (nicht zu verwechseln mit dem eingefrorenen Sitz in einem Spiel). */
export interface PlayerRecord {
  id: string;
  name: string;
  color: number;
  /** Angelegt am. */
  at: number;
  /** Zuletzt geändert; entscheidet beim Abgleich. */
  u: number;
  /** Archiviert: nicht mehr zur Auswahl, aber in alten Spielen erhalten. */
  arch: boolean;
}

export interface Settings {
  /** Bildschirm während des Spiels wach halten. */
  wake: boolean;
  /** Zuletzt gewählte Spieler je Spiel (Spieler-IDs in Reihenfolge). */
  last: Record<string, string[]>;
  /** Einstellungen je Spiel, so wie sie die jeweilige Engine definiert. */
  games: Record<string, unknown>;
}

export interface Meta {
  players: PlayerRecord[];
  settings: Settings;
  u: number;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Macht aus einem beliebigen Dokument gültige Stammdaten; fehlende Teile bekommen Standardwerte. */
export function normalizeMeta(raw: unknown): Meta {
  const m = (raw ?? {}) as Record<string, any>;
  const st = (m['settings'] ?? {}) as Record<string, any>;

  const players: PlayerRecord[] = (Array.isArray(m['players']) ? m['players'] : [])
    .filter((p: any) => p && isId(p.id) && typeof p.name === 'string')
    .map((p: any) => ({
      id: p.id,
      name: p.name.slice(0, MAX_NAME_LENGTH),
      color: (((num(p.color) | 0) % PLAYER_COLORS) + PLAYER_COLORS) % PLAYER_COLORS,
      at: num(p.at),
      u: num(p.u),
      arch: !!p.arch,
    }));

  const games: Record<string, unknown> = {};
  const last: Record<string, string[]> = {};
  for (const engine of ENGINES) {
    // ältere Fassungen legten die Einstellungen direkt unter settings.<spiel> ab
    games[engine.id] = engine.normalizeOptions({ ...(st[engine.id] ?? {}), ...(st['games']?.[engine.id] ?? {}) });
    last[engine.id] = strings(st['last']?.[engine.id]);
  }
  return { players, settings: { wake: !!st['wake'], last, games }, u: num(m['u']) };
}

/** Führt zwei Fassungen zusammen: Spieler einzeln nach Änderungszeit, Einstellungen von der neueren Fassung. */
export function mergeMeta(local: Meta, remote: Meta): Meta {
  const byId = new Map<string, PlayerRecord>();
  for (const p of [...local.players, ...remote.players]) {
    const old = byId.get(p.id);
    if (!old || p.u > old.u) byId.set(p.id, p);
  }
  const order = [...local.players.map(p => p.id), ...remote.players.map(p => p.id)].filter((id, i, a) => a.indexOf(id) === i);
  const [newer, older] = remote.u > local.u ? [remote, local] : [local, remote];
  const settings = clone(newer.settings);
  for (const engine of ENGINES) {
    if (engine.mergeOptions) settings.games[engine.id] = engine.mergeOptions(newer.settings.games[engine.id], older.settings.games[engine.id]);
  }
  return { players: order.map(id => byId.get(id)!), settings, u: Math.max(local.u, remote.u) };
}
