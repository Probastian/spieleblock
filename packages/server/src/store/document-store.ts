import fs from 'node:fs';
import path from 'node:path';
import { belongsToTable } from '@spieleblock/shared';
import type { Logger } from '../logger';

export interface StoredDoc {
  d: Record<string, unknown>;
  /** Zeitpunkt der letzten Änderung (ms). */
  t: number;
}

export interface StoreOptions {
  dataDir: string;
  maxDocs: number;
  backupKeep: number;
  tableTtlDays: number;
  log: Logger;
  /** Wird nach jeder Änderung mit dem Pfad aufgerufen (auch bei Aufräumarbeiten). */
  onChange?: (path: string) => void;
}

const JOURNAL_COMPACT_LINES = 2000;
const TABLE_DOC = /^tables\/([A-Z0-9]+)$/;
const DAY_MS = 864e5;

const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/'));

/**
 * Dokumentenspeicher im Arbeitsspeicher. Jede Änderung geht zuerst als Zeile ins Journal; ab und zu
 * wird alles in einen Snapshot zusammengeführt. Ein Absturz verliert deshalb nichts (eine halb
 * geschriebene letzte Zeile wird beim Laden ignoriert).
 */
export class DocumentStore {
  private readonly docs = new Map<string, StoredDoc>();
  private readonly kids = new Map<string, Set<string>>();
  private readonly snapshotFile: string;
  private readonly journalFile: string;
  private readonly backupDir: string;
  private journalFd: number;
  private journalLines = 0;
  private dirty = false;

  constructor(private readonly opts: StoreOptions) {
    this.backupDir = path.join(opts.dataDir, 'backups');
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.snapshotFile = path.join(opts.dataDir, 'snapshot.json');
    this.journalFile = path.join(opts.dataDir, 'journal.jsonl');
    this.journalLines = this.load();
    this.journalFd = fs.openSync(this.journalFile, 'a');
  }

  get size(): number {
    return this.docs.size;
  }

  has(p: string): boolean {
    return this.docs.has(p);
  }

  get(p: string): Record<string, unknown> | null {
    return this.docs.get(p)?.d ?? null;
  }

  /** Dokumente direkt unter einem Sammlungspfad. */
  children(collectionPath: string): { id: string; data: Record<string, unknown> }[] {
    const out: { id: string; data: Record<string, unknown> }[] = [];
    for (const full of this.kids.get(collectionPath) ?? []) out.push({ id: full.slice(full.lastIndexOf('/') + 1), data: this.docs.get(full)!.d });
    return out;
  }

  /** Legt ein Dokument an oder ersetzt es. Gibt `false` zurück, wenn der Speicher voll ist. */
  put(p: string, data: Record<string, unknown>, t = Date.now()): boolean {
    if (!this.docs.has(p) && this.docs.size >= this.opts.maxDocs) return false;
    this.applyPut(p, data, t);
    this.writeJournal({ p, d: data, t });
    this.opts.onChange?.(p);
    return true;
  }

  delete(p: string): boolean {
    if (!this.docs.has(p)) return false;
    this.applyDelete(p);
    this.writeJournal({ x: 1, p });
    this.opts.onChange?.(p);
    return true;
  }

  /** Aufräumen, Journal zusammenführen, Tagesbackup. Alle paar Minuten aufzurufen. */
  maintain(): void {
    try {
      this.cleanupTables();
      if (this.dirty && this.journalLines > JOURNAL_COMPACT_LINES) this.writeSnapshot();
      this.dailyBackup();
    } catch (e) {
      this.opts.log.error('Wartung fehlgeschlagen:', e);
    }
  }

  /** Beim Beenden: alles in den Snapshot schreiben. */
  close(): void {
    this.writeSnapshot();
    fs.closeSync(this.journalFd);
  }

  // ---------------------------------------------------------------- intern
  private applyPut(p: string, d: Record<string, unknown>, t: number): void {
    if (!this.docs.has(p)) {
      const par = parentOf(p);
      let set = this.kids.get(par);
      if (!set) this.kids.set(par, (set = new Set()));
      set.add(p);
    }
    this.docs.set(p, { d, t });
  }

  private applyDelete(p: string): void {
    if (!this.docs.delete(p)) return;
    const par = parentOf(p);
    const set = this.kids.get(par);
    if (set) {
      set.delete(p);
      if (!set.size) this.kids.delete(par);
    }
  }

  private load(): number {
    let fromSnapshot = 0;
    try {
      const snap = JSON.parse(fs.readFileSync(this.snapshotFile, 'utf8')) as { docs?: Record<string, StoredDoc> };
      for (const [p, v] of Object.entries(snap.docs ?? {})) {
        this.applyPut(p, v.d, v.t || 0);
        fromSnapshot++;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Snapshot nicht lesbar: ${(e as Error).message}`);
    }

    let replayed = 0;
    let broken = 0;
    try {
      for (const line of fs.readFileSync(this.journalFile, 'utf8').split('\n')) {
        if (!line) continue;
        try {
          const o = JSON.parse(line) as { x?: number; p: string; d?: Record<string, unknown>; t?: number };
          if (o.x) this.applyDelete(o.p);
          else this.applyPut(o.p, o.d ?? {}, o.t || 0);
          replayed++;
        } catch {
          broken++; // abgebrochene letzte Zeile nach einem Absturz
        }
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    this.opts.log.info(`Geladen: ${this.docs.size} Dokumente (Snapshot ${fromSnapshot}, Journal ${replayed}${broken ? `, ${broken} defekte Zeilen ignoriert` : ''})`);
    return replayed;
  }

  private writeJournal(entry: object): void {
    fs.writeSync(this.journalFd, JSON.stringify(entry) + '\n');
    this.journalLines++;
    this.dirty = true;
  }

  private writeSnapshot(): void {
    const out = { v: 1, saved: new Date().toISOString(), docs: Object.fromEntries(this.docs) };
    const tmp = this.snapshotFile + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    fs.writeSync(fd, JSON.stringify(out));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmp, this.snapshotFile);
    fs.closeSync(this.journalFd);
    fs.writeFileSync(this.journalFile, '');
    this.journalFd = fs.openSync(this.journalFile, 'a');
    this.journalLines = 0;
    this.dirty = false;
  }

  private dailyBackup(): void {
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(this.backupDir, `${day}.json`);
    if (fs.existsSync(file) || !this.docs.size) return;
    this.writeSnapshot();
    fs.copyFileSync(this.snapshotFile, file);
    const all = fs.readdirSync(this.backupDir).filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - this.opts.backupKeep))) fs.unlinkSync(path.join(this.backupDir, f));
    this.opts.log.info('Tagesbackup geschrieben:', path.basename(file));
  }

  /** Löscht Live-Tische (samt Plätzen), die länger als die eingestellte Zeit nicht benutzt wurden. */
  private cleanupTables(): void {
    if (!(this.opts.tableTtlDays > 0)) return;
    const limit = Date.now() - this.opts.tableTtlDays * DAY_MS;
    const stale: string[] = [];
    for (const [p, v] of this.docs) {
      const m = TABLE_DOC.exec(p);
      if (m && v.t < limit) stale.push(m[1]!);
    }
    for (const code of stale) for (const p of [...this.docs.keys()]) if (belongsToTable(p, code)) this.delete(p);
    if (stale.length) this.opts.log.info(`Alte Tische entfernt: ${stale.length}`);
  }
}
