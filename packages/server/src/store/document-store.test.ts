import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { silentLog } from '../test-support';
import { DocumentStore } from './document-store';

const dirs: string[] = [];
const open = (dir: string, extra: Partial<ConstructorParameters<typeof DocumentStore>[0]> = {}) =>
  new DocumentStore({ dataDir: dir, maxDocs: 100, backupKeep: 2, tableTtlDays: 30, log: silentLog, ...extra });
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-store-'));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })));

describe('DocumentStore', () => {
  it('speichert, liest und listet Kinder', () => {
    const s = open(tmp());
    s.put('tables/ABCDE', { x: 1 });
    s.put('tables/ABCDE/seats/0', { uid: 'u' });
    s.put('tables/ABCDE/seats/1', { uid: 'v' });
    expect(s.get('tables/ABCDE')).toEqual({ x: 1 });
    expect(s.children('tables/ABCDE/seats').map(c => c.id).sort()).toEqual(['0', '1']);
    expect(s.delete('tables/ABCDE/seats/0')).toBe(true);
    expect(s.children('tables/ABCDE/seats')).toHaveLength(1);
    expect(s.delete('tables/ABCDE/seats/0')).toBe(false);
    s.close();
  });

  it('überlebt einen Absturz über das Journal, auch mit halber letzter Zeile', () => {
    const dir = tmp();
    const s = open(dir);
    s.put('tables/ABCDE', { a: 1 });
    s.put('tables/FGHJK', { b: 2 });
    s.delete('tables/FGHJK');
    // kein close(): so als wäre der Prozess abgestürzt
    fs.appendFileSync(path.join(dir, 'journal.jsonl'), '{"p":"tables/BROK');
    const again = open(dir);
    expect(again.get('tables/ABCDE')).toEqual({ a: 1 });
    expect(again.has('tables/FGHJK')).toBe(false);
    again.close();
  });

  it('führt beim Beenden Journal und Snapshot zusammen', () => {
    const dir = tmp();
    const s = open(dir);
    s.put('tables/ABCDE', { a: 1 });
    s.close();
    expect(fs.readFileSync(path.join(dir, 'journal.jsonl'), 'utf8')).toBe('');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8')).docs['tables/ABCDE'].d).toEqual({ a: 1 });
    open(dir).close();
  });

  it('lehnt neue Dokumente ab, wenn der Speicher voll ist', () => {
    const s = open(tmp(), { maxDocs: 1 });
    expect(s.put('tables/AAAAA', {})).toBe(true);
    expect(s.put('tables/BBBBB', {})).toBe(false);
    expect(s.put('tables/AAAAA', { again: true })).toBe(true); // Ersetzen bleibt erlaubt
    s.close();
  });

  it('entfernt alte Tische samt Plätzen, lässt Nutzerdaten in Ruhe', () => {
    const changed: string[] = [];
    const s = open(tmp(), { tableTtlDays: 1, onChange: p => changed.push(p) });
    const old = Date.now() - 3 * 864e5;
    s.put('tables/OLDAA', {}, old);
    s.put('tables/OLDAA/seats/0', {}, old);
    s.put('tables/NEWAA', {});
    s.put('data/users/0123456789abcdef/meta', {}, old);
    changed.length = 0;
    s.maintain();
    expect(s.has('tables/OLDAA')).toBe(false);
    expect(s.has('tables/OLDAA/seats/0')).toBe(false);
    expect(s.has('tables/NEWAA')).toBe(true);
    expect(s.has('data/users/0123456789abcdef/meta')).toBe(true);
    expect(changed).toContain('tables/OLDAA');
    s.close();
  });

  it('schreibt ein Tagesbackup und behält nur die letzten', () => {
    const dir = tmp();
    const s = open(dir);
    const backups = path.join(dir, 'backups');
    for (const day of ['2020-01-01', '2020-01-02', '2020-01-03']) fs.writeFileSync(path.join(backups, `${day}.json`), '{}');
    s.put('tables/ABCDE', {});
    s.maintain();
    const files = fs.readdirSync(backups).sort();
    expect(files).toHaveLength(2);
    expect(files[1]).toBe(`${new Date().toISOString().slice(0, 10)}.json`);
    s.close();
  });
});
