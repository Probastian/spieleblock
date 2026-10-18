/** Ein Spieler am Tisch, so wie er in einem Spiel gespeichert ist (Name und Farbe sind eingefroren). */
export interface SeatedPlayer {
  /** Verweis auf den Eintrag in der Spielerliste; `null` für Gäste. */
  pid: string | null;
  name: string;
  /** 0 bis 7, Index in die Farbpalette. */
  color: number;
}

export type GameStatus = 'active' | 'finished';

export interface GameRecord {
  best: number;
  prev: number;
}

/** Felder, die jedes Spiel hat, egal welcher Art. Spiel-spezifisches kommt in der erweiterten Schnittstelle dazu. */
export interface BaseGame<P extends SeatedPlayer = SeatedPlayer> {
  id: string;
  /** Kennung der Engine, z. B. `kniffel`. */
  type: string;
  status: GameStatus;
  created: number;
  /** Zeitpunkt der letzten Änderung (ms); entscheidet beim Abgleich, welche Fassung gilt. */
  u: number;
  finishedAt?: number;
  /** Gelöscht, bleibt aber als Markierung erhalten, bis der Abgleich durch ist. */
  del?: boolean;
  /** Aus der allerersten Version übernommen (nur Endstände). */
  legacy?: boolean;
  players: P[];
  /** Welcher Spieler gerade angezeigt wird (nur lokal). */
  view: number;
  /** Wer am Zug ist. */
  turn: number;
  undo: unknown[];
  record?: GameRecord | null;

  // Live-Tisch. Diese Felder gehören dem einzelnen Gerät und werden nie geteilt.
  tbl?: string;
  tblHost?: boolean;
  tblSeat?: number | null;
  tblBase?: string;
  tblDirty?: boolean;
  tblTake?: boolean;
}

export interface ResultRow {
  /** Index in `game.players`, soweit das Spiel ihn braucht. */
  i?: number;
  pid: string | null;
  name: string;
  color: number;
  total: number;
  /** Zusatzzeile unter dem Ergebnis, z. B. die Aufschlüsselung. */
  sub?: string;
  /** Punkte der letzten Runde (Rundenspiele). */
  last?: number | null;
  place: number;
}

/** Felder, die Spiele in die Zeile mitgeben, bevor der Platz berechnet wird. */
export type UnrankedRow = Omit<ResultRow, 'place'>;
