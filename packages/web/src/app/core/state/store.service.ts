import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { clone, computeRecords, computeStats, engineOf, sortActive, sortFinished, type BaseGame } from '@spieleblock/games';
import { readJson, writeJson } from '../util/storage';
import { MAX_NAME_LENGTH, PLAYER_COLORS, mergeMeta, normalizeMeta, type Meta, type PlayerRecord } from './models';

const LS_CACHE = 'spielblock.v2';
const CACHE_DELAY_MS = 200;

interface CacheShape {
  v: 2;
  meta: Meta;
  games: Record<string, BaseGame>;
  dirty: string[];
}

export interface AddPlayerResult {
  player: PlayerRecord;
  isNew: boolean;
  restored: boolean;
}

/**
 * Der gesamte Zustand der App: Spielerliste, Einstellungen und alle Spiele.
 *
 * Änderungen laufen immer über `updateMeta`/`updateGame`: Sie bekommen eine Kopie zum Verändern,
 * danach wird sie als neue Fassung abgelegt (damit Signals sauber auslösen), im Browser zwischen-
 * gespeichert und zum Server übertragen. Wer das übernimmt, erfährt über `dirty$` und `touched$`.
 */
@Injectable({ providedIn: 'root' })
export class Store {
  readonly meta = signal<Meta>(normalizeMeta(null));
  readonly games = signal<Record<string, BaseGame>>({});

  /** Schlüssel (`meta`, `g/<id>`), die noch nicht auf dem Server sind. */
  readonly dirty = new Set<string>();
  /** Es gibt etwas zu übertragen. */
  readonly dirty$ = new Subject<void>();
  /** Ein Spiel wurde durch den Nutzer verändert (für den Live-Tisch). */
  readonly touched$ = new Subject<BaseGame>();

  readonly players = computed(() => this.meta().players);
  readonly activePlayers = computed(() => this.players().filter(p => !p.arch));
  readonly archivedPlayers = computed(() => this.players().filter(p => p.arch));
  private readonly playerIndex = computed(() => new Map(this.players().map(p => [p.id, p])));

  readonly allGames = computed(() => Object.values(this.games()));
  readonly activeGames = computed(() => sortActive(this.allGames(), engineOf));
  readonly finishedGames = computed(() => sortFinished(this.allGames(), engineOf));
  readonly stats = computed(() => computeStats(this.allGames(), engineOf));
  readonly records = computed(() => computeRecords(this.allGames(), engineOf));
  /** Aktive Spieler, zuletzt aktive zuerst. */
  readonly roster = computed(() => {
    const stats = this.stats();
    return [...this.activePlayers()].sort((a, b) => (stats[b.id]?.last ?? 0) - (stats[a.id]?.last ?? 0) || a.name.localeCompare(b.name, 'de'));
  });

  private cacheTimer: ReturnType<typeof setTimeout> | undefined;

  playerById(id: string | null | undefined): PlayerRecord | undefined {
    return id ? this.playerIndex().get(id) : undefined;
  }

  game(id: string | null | undefined): BaseGame | undefined {
    return id ? this.games()[id] : undefined;
  }

  /** Aktueller Name eines Spielers (die Spielerliste kann nach dem Spiel umbenannt worden sein). */
  currentName(seat: { pid: string | null; name: string }): string {
    return this.playerById(seat.pid)?.name ?? seat.name;
  }

  options<O>(gameType: string): O {
    return this.meta().settings.games[gameType] as O;
  }

  // ------------------------------------------------------------ Änderungen
  updateMeta(fn: (draft: Meta) => void): void {
    const draft = clone(this.meta());
    fn(draft);
    draft.u = Date.now();
    this.meta.set(draft);
    this.markDirty('meta');
  }

  updateGame<T extends BaseGame, R = void>(id: string, fn: (draft: T) => R): R | undefined {
    const current = this.games()[id];
    if (!current) return undefined;
    const draft = clone(current) as T;
    const result = fn(draft);
    draft.u = Date.now();
    this.games.update(all => ({ ...all, [id]: draft }));
    this.touched$.next(draft);
    this.markDirty('g/' + id);
    return result;
  }

  /**
   * Verändert ein Spiel, ohne es als Nutzeränderung zu zählen (Änderungszeit bleibt, kein Live-Tisch-Abgleich).
   * `dirty`: trotzdem zum Server übertragen.
   */
  patchGameSilently(id: string, fn: (draft: BaseGame) => void, dirty = false): void {
    const current = this.games()[id];
    if (!current) return;
    const draft = clone(current);
    fn(draft);
    this.games.update(all => ({ ...all, [id]: draft }));
    if (dirty) this.markDirty('g/' + id);
    else this.saveCacheSoon();
  }

  /** Legt ein neues Spiel an. */
  addGame(game: BaseGame): void {
    game.u = Date.now();
    this.games.update(all => ({ ...all, [game.id]: game }));
    this.touched$.next(game);
    this.markDirty('g/' + game.id);
  }

  /** Setzt eine Fassung, die von außen kommt (Server, Live-Tisch), ohne sie als Änderung zu zählen. */
  setGameSilently(game: BaseGame): void {
    this.games.update(all => ({ ...all, [game.id]: game }));
    this.saveCacheSoon();
  }

  setMetaSilently(meta: Meta): void {
    this.meta.set(meta);
    this.saveCacheSoon();
  }

  markDirty(key: string): void {
    this.dirty.add(key);
    this.saveCacheSoon();
    this.dirty$.next();
  }

  // --------------------------------------------------------------- Spieler
  addPlayer(rawName: string): AddPlayerResult | null {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return null;
    const existing = this.players().find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.arch) this.updatePlayer(existing.id, { arch: false });
      return { player: this.playerById(existing.id)!, isNew: false, restored: existing.arch };
    }
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const usage = Array<number>(PLAYER_COLORS).fill(0);
    for (const p of this.activePlayers()) usage[p.color]!++;
    const now = Date.now();
    const player: PlayerRecord = { id, name, color: usage.indexOf(Math.min(...usage)), at: now, u: now, arch: false };
    this.updateMeta(m => void m.players.push(player));
    return { player, isNew: true, restored: false };
  }

  updatePlayer(id: string, patch: Partial<Pick<PlayerRecord, 'name' | 'color' | 'arch'>>): void {
    this.updateMeta(m => {
      const p = m.players.find(x => x.id === id);
      if (p) Object.assign(p, patch, { u: Date.now() });
    });
  }

  // ----------------------------------------------------------- Einstellungen
  setGameOptions<O extends object>(gameType: string, patch: Partial<O>): void {
    this.updateMeta(m => {
      m.settings.games[gameType] = { ...(m.settings.games[gameType] as O), ...patch };
    });
  }

  setLineup(gameType: string, playerIds: string[]): void {
    this.updateMeta(m => {
      m.settings.last[gameType] = playerIds;
    });
  }

  setWake(on: boolean): void {
    this.updateMeta(m => {
      m.settings.wake = on;
    });
  }

  // ------------------------------------------------------------- Zwischenspeicher
  loadCache(): void {
    const c = readJson<Partial<CacheShape>>(LS_CACHE);
    if (!c) return;
    this.meta.set(normalizeMeta(c.meta));
    this.games.set(c.games && typeof c.games === 'object' ? c.games : {});
    for (const k of c.dirty ?? []) if (typeof k === 'string') this.dirty.add(k);
  }

  saveCacheSoon(): void {
    clearTimeout(this.cacheTimer);
    this.cacheTimer = setTimeout(() => this.saveCacheNow(), CACHE_DELAY_MS);
  }

  saveCacheNow(): void {
    clearTimeout(this.cacheTimer);
    writeJson(LS_CACHE, { v: 2, meta: this.meta(), games: this.games(), dirty: [...this.dirty], migrated: true });
  }

  /** Zusammenführen für Backup und Server-Abgleich. */
  mergedMeta(remote: Meta): Meta {
    return mergeMeta(this.meta(), remote);
  }
}
