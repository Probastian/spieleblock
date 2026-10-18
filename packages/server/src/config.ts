import fs from 'node:fs';
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
  /** Release-Version, z. B. `v2.0.1`; `dev` ohne Release. */
  version: string;
  /**
   * Darf die Oberfläche eine Update-Prüfung anfordern? Der Server legt dann `update-request` im Datenordner an
   * und liest `update-status.json`; das eigentliche Update macht deploy/update.sh (siehe docs/betrieb.md).
   */
  updateFromUi: boolean;
  /** Client-ID der Spotify-App für Hitster. Öffentlich, wird der Web-App mitgeteilt. Leer = Hitster ohne Spotify. */
  spotifyClientId: string;
}

type Env = Record<string, string | undefined>;

/** Version aus `APP_VERSION` oder der Datei `VERSION` neben der Server-Datei (legen Release-Paket und Docker-Image an). */
function readVersion(env: Env, baseDir: string): string {
  let raw = env['APP_VERSION']?.trim() ?? '';
  if (!raw) {
    try {
      raw = fs.readFileSync(path.join(baseDir, 'VERSION'), 'utf8').trim();
    } catch {
      /* keine Datei: Entwicklungsstand */
    }
  }
  if (!raw) return 'dev';
  return /^\d/.test(raw) ? 'v' + raw : raw;
}

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
    version: readVersion(env, baseDir),
    updateFromUi: /^(1|true|yes)$/i.test(str('UPDATE_FROM_UI', '')),
    spotifyClientId: /^[A-Za-z0-9]{16,64}$/.test(str('SPOTIFY_CLIENT_ID', '')) ? str('SPOTIFY_CLIENT_ID', '') : '',
  };
}
