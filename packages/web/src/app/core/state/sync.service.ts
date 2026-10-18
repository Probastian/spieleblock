import { Injectable, computed, inject, signal } from '@angular/core';
import { ENDPOINTS, userGamePath, userGamesPath, userMetaPath, type MeResponse } from '@spieleblock/shared';
import { clone, engineOf, num, type BaseGame } from '@spieleblock/games';
import { ApiHttp } from '../api/http.service';
import { DeviceService } from '../api/device.service';
import { RemoteDb } from '../api/remote-db.service';
import { normalizeMeta, type Meta } from './models';
import { Store } from './store.service';

export type SyncState = 'connect' | 'syncing' | 'ok' | 'local' | 'error';

export const SYNC_LABEL: Record<SyncState, string> = {
  connect: 'Verbinde …',
  syncing: 'Speichert …',
  ok: 'Gespeichert',
  local: 'Nur lokal',
  error: 'Wartet auf Sync',
};

const FLUSH_DELAY_MS = 500;
const RETRY_MS = 20_000;
const PULL_AFTER_MS = 45_000;

/**
 * Gleicht den lokalen Zustand mit dem Server ab: geänderte Dokumente hochladen (`flush`), den Stand
 * des Servers holen und zusammenführen (`pull`). Bei Fehlern bleibt alles lokal und wird später erneut versucht.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly store = inject(Store);
  private readonly db = inject(RemoteDb);
  private readonly http = inject(ApiHttp);
  private readonly device = inject(DeviceService);

  readonly state = signal<SyncState>('connect');
  /** Der erste Abgleich ist durch (oder es gibt keinen Server). */
  readonly ready = signal(false);
  /** Öffentliche Nutzer-ID; `null`, solange der Server nicht erreicht wurde. */
  readonly uid = signal<string | null>(null);
  readonly connected = computed(() => this.uid() !== null);
  readonly label = computed(() => SYNC_LABEL[this.state()]);

  private flushing = false;
  private lastPull = 0;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.store.dirty$.subscribe(() => this.scheduleFlush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.store.saveCacheNow();
        void this.flush();
      } else if (this.connected() && Date.now() - this.lastPull > PULL_AFTER_MS && !this.store.dirty.size && !this.flushing) {
        void this.pull().catch(() => undefined);
      }
    });
    addEventListener('pagehide', () => {
      this.store.saveCacheNow();
      void this.flush();
    });
    addEventListener('online', () => {
      if (this.connected()) void this.flush();
    });
  }

  /** Ermittelt die Nutzer-ID und gleicht zum ersten Mal ab. Ohne Server bleibt die App lokal und versucht es später wieder. */
  async start(): Promise<void> {
    let uid = this.device.uid;
    if (!uid) {
      try {
        uid = (await this.http.request<MeResponse>('GET', ENDPOINTS.me)).uid;
        this.device.rememberUid(uid);
      } catch {
        this.state.set('local');
        this.ready.set(true);
        this.retryTimer = setTimeout(() => void this.start(), RETRY_MS);
        return;
      }
    }
    this.uid.set(uid);
    await this.syncNow();
  }

  async syncNow(): Promise<void> {
    if (!this.connected()) return;
    this.state.set('syncing');
    try {
      await this.pull();
      this.ready.set(true);
      await this.flush();
    } catch {
      this.ready.set(true);
      this.state.set('error');
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => void this.syncNow(), RETRY_MS);
    }
  }

  scheduleFlush(): void {
    if (!this.connected()) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), FLUSH_DELAY_MS);
  }

  async flush(): Promise<void> {
    const uid = this.uid();
    if (!uid || this.flushing) return;
    if (!this.store.dirty.size) {
      if (this.state() !== 'ok') this.state.set('ok');
      return;
    }
    this.flushing = true;
    this.state.set('syncing');
    try {
      for (let guard = 0; this.store.dirty.size && guard < 2000; guard++) {
        const key = this.store.dirty.values().next().value as string;
        const data = this.dataFor(key);
        if (!data) {
          this.store.dirty.delete(key);
          continue;
        }
        const version = data.u;
        await this.db.setDoc(key === 'meta' ? userMetaPath(uid) : userGamePath(uid, key.slice(2)), clone(data));
        const current = this.dataFor(key);
        if (current && current.u === version) this.store.dirty.delete(key);
      }
      this.state.set('ok');
    } catch {
      this.state.set('error');
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => void this.flush(), RETRY_MS);
    } finally {
      this.flushing = false;
      this.store.saveCacheNow();
    }
  }

  /** Holt den Stand vom Server und führt ihn mit dem lokalen zusammen. Neuere Fassung gewinnt. */
  async pull(): Promise<boolean> {
    const uid = this.uid();
    if (!uid) return false;
    const [metaDoc, gameDocs] = await Promise.all([this.db.getDoc<Meta>(userMetaPath(uid)), this.db.getCollection<BaseGame>(userGamesPath(uid))]);
    const store = this.store;
    let changed = false;

    if (metaDoc.exists) {
      const remote = normalizeMeta(clone(metaDoc.data));
      const merged = store.mergedMeta(remote);
      if (JSON.stringify(merged) !== JSON.stringify(store.meta())) {
        store.setMetaSilently(merged);
        changed = true;
      }
      if (JSON.stringify(merged) !== JSON.stringify(remote)) store.dirty.add('meta');
    } else if (store.players().length || store.meta().u) {
      store.dirty.add('meta');
    }

    const seen = new Set<string>();
    for (const doc of gameDocs) {
      seen.add(doc.id);
      const remote = doc.data;
      if (!remote || !engineOf(remote.type)) continue;
      const local = store.game(doc.id);
      if (!local) {
        store.setGameSilently(clone(remote));
        changed = true;
      } else if (num(remote.u) > num(local.u)) {
        if (!store.dirty.has('g/' + doc.id)) {
          store.setGameSilently(clone(remote));
          changed = true;
        }
      } else if (num(local.u) > num(remote.u)) store.dirty.add('g/' + doc.id);
    }
    for (const id of Object.keys(store.games())) if (!seen.has(id)) store.dirty.add('g/' + id);

    this.lastPull = Date.now();
    store.saveCacheNow();
    return changed;
  }

  private dataFor(key: string): { u: number } | undefined {
    return key === 'meta' ? this.store.meta() : this.store.game(key.slice(2));
  }
}
