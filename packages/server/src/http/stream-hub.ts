import type { IncomingMessage, ServerResponse } from 'node:http';
import { HEARTBEAT_MS, type StreamMessage, type WatchSpec } from '@spieleblock/shared';
import type { DocumentStore } from '../store/document-store';

interface Client {
  res: ServerResponse;
  watches: Map<string, WatchSpec>;
}

const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/'));

/**
 * Live-Verbindungen (Server-Sent Events). Jeder Client abonniert Dokumente und Sammlungen und
 * bekommt bei jeder Änderung den neuen Stand. Das Abo ist eine Liste, die der Client komplett ersetzt.
 */
export class StreamHub {
  private readonly clients = new Map<string, Client>();

  constructor(private readonly store: DocumentStore) {}

  get connections(): number {
    return this.clients.size;
  }

  connect(cid: string, req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx soll nicht puffern
    });
    res.write('retry: 3000\n\n');

    const previous = this.clients.get(cid);
    if (previous) {
      try {
        previous.res.end();
      } catch {
        /* schon geschlossen */
      }
    }

    const client: Client = { res, watches: new Map() };
    this.clients.set(cid, client);
    this.send(client, { hello: true, t: Date.now() });

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* wird beim Schließen entfernt */
      }
    }, HEARTBEAT_MS);
    req.on('close', () => {
      clearInterval(heartbeat);
      if (this.clients.get(cid) === client) this.clients.delete(cid);
    });
  }

  has(cid: string): boolean {
    return this.clients.has(cid);
  }

  /** Ersetzt die Abos eines Clients; neue oder geänderte bekommen sofort den aktuellen Stand. */
  setWatches(cid: string, next: Map<string, WatchSpec>): boolean {
    const client = this.clients.get(cid);
    if (!client) return false;
    const fresh: WatchSpec[] = [];
    for (const [id, w] of next) {
      const old = client.watches.get(id);
      if (!old || old.path !== w.path || old.kind !== w.kind) fresh.push(w);
    }
    client.watches = next;
    for (const w of fresh) this.push(client, w);
    return true;
  }

  /** Schickt allen Abonnenten den neuen Stand von `changedPath`. */
  notify(changedPath: string): void {
    const parent = parentOf(changedPath);
    for (const client of this.clients.values()) {
      for (const w of client.watches.values()) {
        if ((w.kind === 'doc' && w.path === changedPath) || (w.kind === 'col' && w.path === parent)) this.push(client, w);
      }
    }
  }

  private push(client: Client, w: WatchSpec): void {
    if (w.kind === 'doc') {
      const data = this.store.get(w.path);
      this.send(client, { id: w.id, exists: data !== null, data });
    } else {
      this.send(client, { id: w.id, docs: this.store.children(w.path) });
    }
  }

  private send(client: Client, msg: StreamMessage): void {
    try {
      client.res.write('data: ' + JSON.stringify(msg) + '\n\n');
    } catch {
      /* wird beim Schließen entfernt */
    }
  }
}
