import path from 'node:path';

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  publicDir: string;
  /** Leer = kein Zugangscode. */
  accessKey: string;
  /** Live-Tische ohne Aktivität werden nach so vielen Tagen gelöscht (0 = nie). */
  tableTtlDays: number;
  backupKeep: number;
  maxDocs: number;
  maxDocBytes: number;
  ratePerMin: number;
  log: boolean;
}

type Env = Record<string, string | undefined>;

/** Liest die Einstellungen aus den Umgebungsvariablen. `baseDir` ist der Ordner der Server-Datei. */
export function loadConfig(env: Env, baseDir: string): Config {
  const str = (key: string, fallback: string) => (env[key] !== undefined && env[key] !== '' ? env[key]! : fallback);
  const int = (key: string, fallback: number) => {
    const n = Number(str(key, String(fallback)));
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    port: int('PORT', 3000),
    host: str('HOST', '0.0.0.0'),
    dataDir: path.resolve(str('DATA_DIR', path.join(baseDir, 'data'))),
    publicDir: path.resolve(str('PUBLIC_DIR', path.join(baseDir, 'public'))),
    accessKey: str('ACCESS_KEY', ''),
    tableTtlDays: int('TABLE_TTL_DAYS', 30),
    backupKeep: int('BACKUP_KEEP', 14),
    maxDocs: int('MAX_DOCS', 50_000),
    maxDocBytes: int('MAX_DOC_BYTES', 262_144),
    ratePerMin: int('RATE_PER_MIN', 1200),
    log: str('LOG', '1') !== '0',
  };
}
