import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { clone, engineOf, isId, num, sanitizeGame, type BaseGame } from '@spieleblock/games';
import { generateTableCode, isTableCode, merge3, normalizeTableCode, sameJson, seatPath, seatsPath, tablePath } from '@spieleblock/shared';
import { RemoteDb } from '../api/remote-db.service';
import { Store } from '../state/store.service';
import { SyncService } from '../state/sync.service';
import { ToastService } from '../ui/toast.service';

/** Das geteilte Dokument eines Live-Tischs unter `tables/<CODE>`. */
interface TableDoc {
  code: string;
  host: string;
  created: number;
  u: number;
  game: BaseGame;
}

/** Plätze eines Tischs: Farbe → Nutzer-ID. */
type Seats = Record<string, string>;

/** Felder, die nur dieses Gerät betreffen. Jede Engine ergänzt eigene (z. B. die Würfelablage). */
const LOCAL_KEYS = ['undo', 'view', 'tbl', 'tblHost', 'tblSeat', 'tblBase', 'tblDirty', 'tblTake', 'del', 'legacy'];
const TABLE_KEYS = ['tbl', 'tblHost', 'tblSeat', 'tblBase', 'tblDirty', 'tblTake'];
const FLUSH_DELAY_MS = 300;
const MAX_TRIES = 4;
const RECENT_MS = 12 * 3600e3;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const localKeysOf = (type: string): string[] => [...LOCAL_KEYS, ...(engineOf(type)?.localKeys ?? [])];

/** Die gemeinsame Fassung eines Spiels: ohne alles, was nur das eigene Gerät betrifft. */
function sharedForm(g: BaseGame): Record<string, unknown> {
  const o = clone(g) as unknown as Record<string, unknown>;
  for (const k of localKeysOf(g.type)) delete o[k];
  return o;
}

function normalizeShared(g: unknown): string | null {
  const clean = sanitizeGame(g, engineOf);
  return clean ? JSON.stringify(sharedForm(clean)) : null;
}

/** Legt die gemeinsame Fassung über das lokale Spiel, lässt aber die lokalen Felder in Ruhe. */
function applyShared(local: BaseGame, shared: Record<string, unknown>): void {
  const keep = localKeysOf(local.type);
  const target = local as unknown as Record<string, unknown>;
  for (const k of Object.keys(target)) if (!keep.includes(k)) delete target[k];
  Object.assign(target, clone(shared));
  local.view = Math.min(local.players.length - 1, Math.max(0, num(local.view) | 0));
}

/**
 * Live-Tisch: ein Spiel gemeinsam auf mehreren Handys.
 *
 *   tables/<CODE>              { code, host, created, u, game }   das geteilte Spiel
 *   tables/<CODE>/seats/<c>    { uid, at }                         wer welchen Platz besetzt
 *
 * Jedes Gerät hält eine lokale Kopie. Änderungen werden nach kurzer Pause hochgeladen und dabei per
 * Dreiwege-Merge (letzter gemeinsamer Stand, meiner, ihrer) mit gleichzeitigen Änderungen anderer verbunden.
 */
@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly store = inject(Store);
  private readonly sync = inject(SyncService);
  private readonly db = inject(RemoteDb);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Belegte Plätze je Tisch-Code. */
  readonly seats = signal<Record<string, Seats>>({});

  private readonly subscriptions = new Map<string, () => void>();
  private readonly base = new Map<string, string>();
  private readonly version = new Map<string, number>();
  private readonly busy = new Set<string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly tries = new Map<string, number>();
  private lastErrorToast = 0;
  private booted = false;

  constructor() {
    this.store.touched$.subscribe(g => {
      if (g.tbl) this.schedule(g);
    });
    // Sobald der erste Abgleich mit dem Server durch ist, laufende Tische wieder abonnieren
    effect(() => {
      if (this.sync.uid() && this.sync.ready()) untracked(() => this.boot());
    });
  }

  private get uid(): string {
    return this.sync.uid() ?? '';
  }

  gamesAt(code: string): BaseGame[] {
    return this.store.allGames().filter(g => g.tbl === code && !g.del);
  }

  mySeat(code: string): number | null {
    const map = this.seats()[code] ?? {};
    const color = Object.keys(map).find(k => map[k] === this.uid);
    return color === undefined ? null : +color;
  }

  // ------------------------------------------------------------- Schreiben
  private schedule(g: BaseGame): void {
    this.store.patchGameSilently(g.id, d => void (d.tblDirty = true));
    if (!this.sync.uid()) return;
    this.version.set(g.id, (this.version.get(g.id) ?? 0) + 1);
    clearTimeout(this.timers.get(g.id));
    this.timers.set(g.id, setTimeout(() => void this.flush(g.id), FLUSH_DELAY_MS));
  }

  private async flush(id: string): Promise<void> {
    if (this.busy.has(id) || !this.sync.uid()) return;
    this.busy.add(id);
    try {
      for (let guard = 0; guard < 5; guard++) {
        const g = this.store.game(id);
        if (!g?.tbl) break;
        const version = this.version.get(id) ?? 0;
        const path = tablePath(g.tbl);
        const snap = await this.db.getDoc<TableDoc>(path);

        let out = sharedForm(g);
        let host = this.uid;
        let created = Date.now();
        if (snap.exists && snap.data) {
          host = snap.data.host || host;
          created = snap.data.created || created;
          const remoteGame = sanitizeGame(snap.data.game, engineOf);
          if (remoteGame && remoteGame.id === g.id) {
            const remote = sharedForm(remoteGame);
            const baseJson = this.base.get(id);
            out = merge3(baseJson ? JSON.parse(baseJson) : remote, out, remote);
          } else if (remoteGame && !g.tblTake) {
            this.busy.delete(id);
            this.moved(g.tbl, snap.data);
            return;
          }
        }
        out['u'] = Date.now();
        const norm = normalizeShared(out);
        if (!norm) break;
        const clean = JSON.parse(norm) as Record<string, unknown>;
        await this.db.setDoc(path, { code: g.tbl, host, created, u: out['u'], game: clean });
        this.base.set(id, norm);
        this.tries.set(id, 0);

        if ((this.version.get(id) ?? 0) === version) {
          this.store.patchGameSilently(
            id,
            d => {
              d.tblBase = norm;
              delete d.tblTake;
              if (!sameJson(sharedForm(d), clean)) applyShared(d, clean);
              d.tblDirty = false;
            },
            true,
          );
          break;
        }
        this.store.patchGameSilently(id, d => {
          d.tblBase = norm;
          delete d.tblTake;
        });
      }
    } catch {
      this.writeFailed(id);
    } finally {
      this.busy.delete(id);
    }
  }

  private writeFailed(id: string): void {
    const n = (this.tries.get(id) ?? 0) + 1;
    this.tries.set(id, n);
    if (n < MAX_TRIES) setTimeout(() => void this.flush(id), 1500 * n);
    else if (Date.now() - this.lastErrorToast > 20_000) {
      this.lastErrorToast = Date.now();
      this.toast.show('Tisch gerade nicht erreichbar, Änderungen bleiben lokal');
    }
  }

  // --------------------------------------------------------------- Lesen
  private adopt(code: string, doc: TableDoc): BaseGame | null {
    const game = sanitizeGame(doc.game, engineOf);
    if (!game || !isId(game.id)) return null;
    const existing = this.store.game(game.id);
    if (existing) return existing;

    game.tbl = code;
    game.tblHost = doc.host === this.uid;
    game.tblSeat = this.mySeat(code);
    if (game.tblSeat != null) game.view = Math.max(0, game.players.findIndex(p => p.color === game.tblSeat));
    const norm = normalizeShared(game)!;
    this.base.set(game.id, norm);
    game.tblBase = norm;
    for (const other of this.store.allGames()) if (other.id !== game.id && other.tbl === code) this.drop(other.id);
    this.store.setGameSilently(game);
    this.store.markDirty('g/' + game.id);
    return game;
  }

  private moved(code: string, doc: TableDoc): void {
    const current = this.gamesAt(code)[0];
    const next = this.adopt(code, doc);
    if (next && current && next.id !== current.id && this.router.url.startsWith('/spiel/' + current.id)) {
      void this.router.navigate(['/spiel', next.id]);
      this.toast.show('Neue Partie am Tisch gestartet');
    }
  }

  private onTable(code: string, snap: { exists: boolean; data: TableDoc | null }): void {
    if (!snap.exists || !snap.data) {
      const games = this.gamesAt(code);
      if (!games.length) return;
      games.forEach(g => this.drop(g.id));
      this.unsubscribe(code);
      this.toast.show('Der Live-Tisch wurde beendet. Dein Stand bleibt gespeichert.');
      return;
    }
    const doc = snap.data;
    const remoteGame = sanitizeGame(doc.game, engineOf);
    if (!remoteGame) return;
    const current = this.gamesAt(code).find(g => g.id === remoteGame.id);
    if (!current) return this.moved(code, doc);

    const remoteJson = normalizeShared(remoteGame)!;
    if (remoteJson === this.base.get(current.id)) return;
    const remote = JSON.parse(remoteJson) as Record<string, unknown>;
    const baseJson = this.base.get(current.id);
    const merged = current.tblDirty ? merge3(baseJson ? JSON.parse(baseJson) : remote, sharedForm(current), remote) : remote;
    this.base.set(current.id, remoteJson);
    this.store.patchGameSilently(
      current.id,
      d => {
        applyShared(d, merged);
        d.tblBase = remoteJson;
      },
      true,
    );
  }

  private onSeats(code: string, docs: { id: string; data: { uid?: string } }[]): void {
    const map: Seats = {};
    for (const d of docs) if (d.data?.uid) map[d.id] = d.data.uid;
    this.seats.update(all => ({ ...all, [code]: map }));
    const mine = this.mySeat(code);
    for (const g of this.gamesAt(code)) {
      if (g.tblSeat === mine) continue;
      this.store.patchGameSilently(
        g.id,
        d => {
          d.tblSeat = mine;
          if (mine != null) {
            const i = d.players.findIndex(p => p.color === mine);
            if (i >= 0) d.view = i;
          }
        },
        true,
      );
    }
  }

  private subscribe(code: string): void {
    if (!this.sync.uid() || this.subscriptions.has(code)) return;
    const stopTable = this.db.watchDoc<TableDoc>(tablePath(code), s => this.onTable(code, s));
    const stopSeats = this.db.watchCollection<{ uid?: string }>(seatsPath(code), docs => this.onSeats(code, docs));
    this.subscriptions.set(code, () => {
      stopTable();
      stopSeats();
    });
  }

  private unsubscribe(code: string): void {
    if (this.gamesAt(code).length) return;
    this.subscriptions.get(code)?.();
    this.subscriptions.delete(code);
  }

  private drop(id: string): void {
    this.store.patchGameSilently(id, d => TABLE_KEYS.forEach(k => delete (d as unknown as Record<string, unknown>)[k]), true);
  }

  /** Nach dem Start: laufende Tische wieder abonnieren, Veraltetes verwerfen. */
  private boot(): void {
    if (this.booted) return;
    this.booted = true;
    for (const g of this.store.allGames()) {
      if (!g.tbl || g.del) continue;
      if (!isTableCode(g.tbl)) {
        this.drop(g.id);
        continue;
      }
      if (g.tblBase) this.base.set(g.id, g.tblBase);
      const recent = g.status !== 'finished' || Date.now() - num(g.finishedAt || g.u) < RECENT_MS;
      if (!recent) {
        this.drop(g.id);
        continue;
      }
      this.subscribe(g.tbl);
      if (g.tblDirty) this.schedule(g);
    }
  }

  // ------------------------------------------------------ Gastgeber / Beitritt
  /** Macht aus dem Spiel einen Live-Tisch. `true`, wenn er läuft. */
  async start(gameId: string): Promise<boolean> {
    const game = this.store.game(gameId);
    if (!game) return false;
    if (!this.sync.uid()) {
      this.toast.show('Der Server ist gerade nicht erreichbar');
      return false;
    }
    if (game.tbl) return true;
    try {
      let code: string | null = null;
      for (let k = 0; k < 6 && !code; k++) {
        const candidate = generateTableCode();
        if (!(await this.db.getDoc(tablePath(candidate))).exists) code = candidate;
      }
      if (!code) {
        this.toast.show('Gerade kein freier Code, bitte nochmal');
        return false;
      }
      const norm = normalizeShared(game)!;
      await this.db.setDoc(tablePath(code), { code, host: this.uid, created: Date.now(), u: Date.now(), game: JSON.parse(norm) });
      this.base.set(gameId, norm);
      this.store.patchGameSilently(
        gameId,
        d => {
          d.tbl = code!;
          d.tblHost = true;
          d.tblSeat = null;
          d.tblBase = norm;
          d.tblDirty = false;
        },
        true,
      );
      this.subscribe(code);
      return true;
    } catch {
      this.toast.show('Live-Tisch konnte nicht gestartet werden');
      return false;
    }
  }

  /** Tritt einem Tisch bei und gibt die ID des lokalen Spiels zurück. */
  async join(rawCode: string): Promise<string | null> {
    if (!this.sync.uid()) {
      this.toast.show('Der Server ist gerade nicht erreichbar');
      return null;
    }
    const code = normalizeTableCode(rawCode);
    if (!isTableCode(code)) {
      this.toast.show('Bitte den Code eingeben');
      return null;
    }
    const existing = this.gamesAt(code)[0];
    if (existing) return existing.id;

    let snap;
    try {
      snap = await this.db.getDoc<TableDoc>(tablePath(code));
    } catch {
      this.toast.show('Tisch gerade nicht erreichbar');
      return null;
    }
    if (!snap.exists || !snap.data) {
      this.toast.show('Keinen Tisch mit diesem Code gefunden');
      return null;
    }
    try {
      this.onSeats(code, await this.db.getCollection<{ uid?: string }>(seatsPath(code)));
    } catch {
      /* Plätze kommen gleich über die Live-Verbindung */
    }
    const game = this.adopt(code, snap.data);
    if (!game) {
      this.toast.show('Dieser Tisch ist ungültig');
      return null;
    }
    this.subscribe(code);
    return game.id;
  }

  async claimSeat(gameId: string, color: number): Promise<void> {
    const game = this.store.game(gameId);
    if (!game?.tbl) return;
    const code = game.tbl;
    try {
      const mine = this.seats()[code] ?? {};
      for (const c of Object.keys(mine).filter(c => mine[c] === this.uid && +c !== color)) await this.db.deleteDoc(seatPath(code, c));
      const current = await this.db.getDoc<{ uid?: string }>(seatPath(code, color));
      if (current.exists && current.data?.uid && current.data.uid !== this.uid) {
        this.toast.show('Der Platz ist schon belegt');
        return;
      }
      await this.db.setDoc(seatPath(code, color), { uid: this.uid, at: Date.now() });
      await sleep(350); // wer gleichzeitig schreibt, verliert: nachsehen, wem der Platz gehört
      const check = await this.db.getDoc<{ uid?: string }>(seatPath(code, color));
      if (!check.exists || check.data?.uid !== this.uid) {
        this.toast.show('Der Platz wurde gerade vergeben');
        return;
      }
      this.seats.update(all => ({ ...all, [code]: { ...(all[code] ?? {}), [color]: this.uid } }));
      this.store.patchGameSilently(
        gameId,
        d => {
          d.tblSeat = color;
          const i = d.players.findIndex(p => p.color === color);
          if (i >= 0) d.view = i;
        },
        true,
      );
      const seated = game.players.find(p => p.color === color);
      this.toast.show(`Du bist ${seated?.name ?? 'dabei'}`);
    } catch {
      this.toast.show('Platz konnte nicht gewählt werden');
    }
  }

  async releaseSeat(gameId: string): Promise<void> {
    const game = this.store.game(gameId);
    if (!game?.tbl) return;
    const code = game.tbl;
    await this.releaseMine(code);
    this.store.patchGameSilently(gameId, d => void (d.tblSeat = null), true);
  }

  /** Gastgeber: Tisch für alle beenden. Gäste: Tisch verlassen. Die lokale Kopie bleibt. */
  async end(gameId: string): Promise<void> {
    const game = this.store.game(gameId);
    if (!game?.tbl) return;
    const { tbl: code, tblHost: host } = game;
    this.drop(gameId);
    if (host) {
      try {
        for (const s of await this.db.getCollection(seatsPath(code))) await this.db.deleteDoc(seatPath(code, s.id));
        await this.db.deleteDoc(tablePath(code));
      } catch {
        /* wird nach der Frist vom Server aufgeräumt */
      }
    } else await this.releaseMine(code);
    this.unsubscribe(code);
    this.toast.show(host ? 'Live-Tisch beendet' : 'Tisch verlassen');
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(`Spieleblock, Live-Tisch-Code: ${code}`);
      this.toast.show('Code kopiert');
    } catch {
      this.toast.show('Code: ' + code);
    }
  }

  /** Neue Partie an einem laufenden Tisch (Revanche): Tisch-Zugehörigkeit wandert zum neuen Spiel. */
  handOver(oldId: string, next: BaseGame): void {
    const old = this.store.game(oldId);
    if (!old?.tbl) return;
    next.tbl = old.tbl;
    next.tblHost = old.tblHost;
    next.tblSeat = old.tblSeat;
    next.tblTake = true;
    const seat = next.players.findIndex(p => p.color === next.tblSeat);
    if (seat >= 0) next.view = seat;
    this.drop(oldId);
  }

  private async releaseMine(code: string): Promise<void> {
    const map = { ...(this.seats()[code] ?? {}) };
    try {
      for (const c of Object.keys(map).filter(c => map[c] === this.uid)) await this.db.deleteDoc(seatPath(code, c));
    } catch {
      /* Platz verfällt mit dem Tisch */
    }
    for (const c of Object.keys(map)) if (map[c] === this.uid) delete map[c];
    this.seats.update(all => ({ ...all, [code]: map }));
  }
}
