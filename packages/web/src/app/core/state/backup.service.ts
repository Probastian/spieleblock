import { Injectable, inject } from '@angular/core';
import { engineOf, num, sanitizeGame } from '@spieleblock/games';
import { normalizeMeta } from './models';
import { Store } from './store.service';
import { todayStamp } from '../util/format';

const FORMAT = 'spielblock-backup';
const MAX_IMPORTED_GAMES = 5000;

export type ImportResult = { ok: true; newPlayers: number; newGames: number } | { ok: false; reason: 'unreadable' | 'foreign' };

/** Sicherung als Datei: alle Spieler und Spiele des Nutzers. Beim Einspielen bleibt vorhandenes erhalten, Neueres gewinnt. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly store = inject(Store);

  download(): void {
    const data = {
      format: FORMAT,
      v: 2,
      exported: new Date().toISOString(),
      meta: this.store.meta(),
      games: this.store.allGames().map(g => ({ ...g, undo: [] })),
    };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spielblock-backup-${todayStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
  }

  import(text: string): ImportResult {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
    if (!data || data.format !== FORMAT || !data.meta || !Array.isArray(data.games)) return { ok: false, reason: 'foreign' };

    const had = new Set(this.store.players().map(p => p.id));
    this.store.updateMeta(m => {
      const merged = this.store.mergedMeta(normalizeMeta(data.meta));
      m.players = merged.players;
      m.settings = merged.settings;
    });
    const newPlayers = this.store.players().filter(p => !had.has(p.id)).length;

    let newGames = 0;
    for (const raw of data.games.slice(0, MAX_IMPORTED_GAMES)) {
      const game = sanitizeGame(raw, engineOf);
      if (!game) continue;
      const local = this.store.game(game.id);
      if (!local) {
        this.store.setGameSilently(game);
        this.store.markDirty('g/' + game.id);
        newGames++;
      } else if (game.u > num(local.u)) {
        this.store.setGameSilently(game);
        this.store.markDirty('g/' + game.id);
      }
    }
    return { ok: true, newPlayers, newGames };
  }
}
