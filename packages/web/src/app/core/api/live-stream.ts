import { ENDPOINTS, STREAM_STALE_MS, isCollectionMessage, isHello, type CollectionEntry, type PathKind, type StreamMessage, type WatchRequest } from '@spieleblock/shared';
import type { ApiHttp } from './http.service';

export interface DocSnapshot<T> {
  id: string;
  exists: boolean;
  data: T | null;
}

type Watch =
  | { kind: 'doc'; path: string; cb: (s: DocSnapshot<unknown>) => void }
  | { kind: 'col'; path: string; cb: (docs: CollectionEntry[]) => void };

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Live-Verbindung zum Server (Server-Sent Events über `fetch`, damit Header möglich sind).
 * Verwaltet die Abos, baut die Verbindung bei Abbruch mit wachsendem Abstand wieder auf und
 * erkennt tote Verbindungen am fehlenden Lebenszeichen.
 */
export class LiveStream {
  private readonly cid = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), b => ID_ALPHABET[b % ID_ALPHABET.length]).join('') + 'xyz';
  private readonly watches = new Map<string, Watch>();
  private seq = 0;
  private streaming = false;
  private connected = false;
  private backoff = 1000;
  private lastByte = 0;
  private ctl: AbortController | null = null;

  constructor(private readonly http: ApiHttp) {
    setInterval(() => {
      if (this.streaming && Date.now() - this.lastByte > STREAM_STALE_MS) this.ctl?.abort();
    }, 10_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !this.watches.size) return;
      if (!this.streaming) this.reconnectNow();
      else if (Date.now() - this.lastByte > 30_000) this.ctl?.abort();
    });
    addEventListener('online', () => {
      if (this.watches.size && !this.streaming) this.reconnectNow();
    });
  }

  watchDoc<T>(path: string, cb: (s: DocSnapshot<T>) => void): () => void {
    return this.add({ kind: 'doc', path, cb: cb as (s: DocSnapshot<unknown>) => void });
  }

  watchCollection<T>(path: string, cb: (docs: CollectionEntry<T>[]) => void): () => void {
    return this.add({ kind: 'col', path, cb: cb as (docs: CollectionEntry[]) => void });
  }

  private add(w: Watch): () => void {
    const id = 'w' + ++this.seq;
    this.watches.set(id, w);
    if (this.connected) void this.pushWatches();
    else this.start();
    return () => {
      this.watches.delete(id);
      if (this.connected) void this.pushWatches();
    };
  }

  private reconnectNow(): void {
    this.backoff = 1000;
    this.start();
  }

  private async pushWatches(): Promise<void> {
    if (!this.connected) return;
    const set: WatchRequest['set'] = [...this.watches].map(([id, w]) => ({ id, kind: w.kind as PathKind, path: w.path }));
    try {
      await this.http.request('POST', ENDPOINTS.watch, { cid: this.cid, set } satisfies WatchRequest);
    } catch {
      /* beim nächsten Verbindungsaufbau erneut */
    }
  }

  private onMessage(m: StreamMessage): void {
    if (isHello(m)) {
      this.connected = true;
      this.backoff = 1000;
      void this.pushWatches();
      return;
    }
    const w = this.watches.get(m.id);
    if (!w) return;
    try {
      if (isCollectionMessage(m) && w.kind === 'col') w.cb(m.docs);
      else if (!isCollectionMessage(m) && w.kind === 'doc') w.cb({ id: w.path.slice(w.path.lastIndexOf('/') + 1), exists: m.exists, data: m.data });
    } catch (e) {
      console.error(e);
    }
  }

  private start(): void {
    if (this.streaming) return;
    this.streaming = true;
    this.ctl = new AbortController();
    this.lastByte = Date.now();
    void this.run(this.ctl.signal).finally(() => {
      this.streaming = false;
      this.connected = false;
      if (!this.watches.size) return;
      setTimeout(() => this.start(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 15_000);
    });
  }

  private async run(signal: AbortSignal): Promise<void> {
    try {
      const res = await this.http.openStream(`${ENDPOINTS.stream}?cid=${this.cid}`, signal);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        this.lastByte = Date.now();
        buffer += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              this.onMessage(JSON.parse(line.slice(6)) as StreamMessage);
            } catch {
              /* kaputte Zeile überspringen */
            }
          }
        }
      }
    } catch {
      /* Abbruch: der Aufrufer baut neu auf */
    }
  }
}
