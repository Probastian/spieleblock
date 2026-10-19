import type { PathKind } from './paths';

/** Header, über die sich die Web-App beim Server ausweist. */
export const HEADERS = {
  deviceKey: 'X-Key',
  access: 'X-Access',
} as const;

export const ENDPOINTS = {
  health: '/healthz',
  info: '/api/info',
  me: '/api/me',
  doc: '/api/doc',
  col: '/api/col',
  stream: '/api/stream',
  watch: '/api/watch',
  update: '/api/update',
  films: '/api/films',
} as const;

/** Fehlercodes in `{ "error": "<code>" }`. Die Namen lehnen sich an gRPC an. */
export type ErrorCode =
  | 'unauthenticated'
  | 'permission_denied'
  | 'invalid_argument'
  | 'invalid_key'
  | 'not_found'
  | 'no_stream'
  | 'method_not_allowed'
  | 'out_of_range'
  | 'resource_exhausted'
  | 'rate_limited'
  | 'unavailable'
  | 'internal'
  | 'closed';

export interface ErrorBody {
  error: ErrorCode;
}

export interface InfoResponse {
  app: 'spieleblock';
  needAccess: boolean;
  ok: boolean;
  /** Release-Version des Servers, z. B. `v2.0.1`, oder `dev`. */
  version: string;
  /** Client-ID der Spotify-App für Hitster (öffentlich, kein Geheimnis); leer = nicht eingerichtet. */
  spotifyClientId: string;
  /** Hat der Server einen TMDB-Zugang für den Film-Zeitstrahl (`TMDB_TOKEN`)? */
  tmdb: boolean;
}

/** Ergebnis der letzten Update-Prüfung auf dem Server (geschrieben von deploy/update.sh). */
export interface UpdateStatus {
  /** Zeitpunkt der Prüfung (ms, Uhr des Servers). */
  checkedAt: number;
  /** `current`: schon aktuell, `updated`: neue Version installiert, `failed`: Prüfung oder Installation gescheitert. */
  state: 'current' | 'updated' | 'failed';
  /** Installierte Version nach der Prüfung. */
  current: string;
  /** Neueste Version auf GitHub, leer wenn sie nicht ermittelt werden konnte. */
  latest: string;
}

export interface UpdateResponse {
  /** Ist „Update aus der Oberfläche“ auf diesem Server eingerichtet (`UPDATE_FROM_UI`)? */
  enabled: boolean;
  status: UpdateStatus | null;
  /** Uhr des Servers (ms), damit die App den Zeitpunkt einer Anforderung mit `checkedAt` vergleichen kann. */
  now: number;
}

export interface MeResponse {
  uid: string;
}

export interface DocResponse<T = unknown> {
  exists: boolean;
  data: T | null;
}

export interface CollectionEntry<T = unknown> {
  id: string;
  data: T;
}

export interface CollectionResponse<T = unknown> {
  docs: CollectionEntry<T>[];
}

/** Ein Abo auf ein Dokument oder eine Sammlung innerhalb der Live-Verbindung. */
export interface WatchSpec {
  id: string;
  kind: PathKind;
  path: string;
}

export interface WatchRequest {
  cid: string;
  set: WatchSpec[];
}

export const MAX_WATCHES = 40;

/** Nachrichten im Event-Stream (`data: <json>`). */
export type StreamMessage =
  | { hello: true; t: number }
  | ({ id: string } & DocResponse & { exists: boolean })
  | ({ id: string } & CollectionResponse);

export const isHello = (m: StreamMessage): m is { hello: true; t: number } => 'hello' in m;
export const isCollectionMessage = (m: StreamMessage): m is { id: string } & CollectionResponse => 'docs' in m;

/** Der Server schickt alle 20 s ein Lebenszeichen; der Client gibt nach 50 s auf. */
export const HEARTBEAT_MS = 20_000;
export const STREAM_STALE_MS = 50_000;

/** Filmlisten des Film-Zeitstrahls, die der Server bei TMDB abfragt. Die Abfragen selbst stehen im Server (`http/films.ts`). */
export const FILM_LISTS = [
  { id: 'beliebt', name: 'Beliebte Filme', blurb: 'Die meistbewerteten Filme aller Zeiten' },
  { id: '2020er', name: '2020er', blurb: 'Filme ab 2020' },
  { id: '2010er', name: '2010er', blurb: 'Filme von 2010 bis 2019' },
  { id: '2000er', name: '2000er', blurb: 'Filme von 2000 bis 2009' },
  { id: '1990er', name: '1990er', blurb: 'Filme von 1990 bis 1999' },
  { id: '1980er', name: '1980er', blurb: 'Filme von 1980 bis 1989' },
  { id: '1970er', name: '1970er', blurb: 'Filme von 1970 bis 1979' },
  { id: 'klassiker', name: 'Klassiker', blurb: 'Filme bis 1969' },
  { id: 'deutsch', name: 'Deutsche Filme', blurb: 'Filme in deutscher Originalsprache' },
  { id: 'animation', name: 'Animation', blurb: 'Trickfilme und Animationsfilme' },
] as const;

export type FilmListId = (typeof FILM_LISTS)[number]['id'];

export const isFilmList = (id: unknown): id is FilmListId => FILM_LISTS.some(l => l.id === id);

/** Ein Film aus TMDB, so wie ihn die App bekommt. */
export interface FilmEntry {
  /** TMDB-ID. */
  id: number;
  title: string;
  /** Originaltitel, leer wenn er dem Titel gleicht. */
  original: string;
  year: number;
  /** Dateiname des Plakats (`abc.jpg`), leer wenn es keines gibt. */
  poster: string;
}

export interface FilmsResponse {
  list: FilmListId;
  films: FilmEntry[];
}
