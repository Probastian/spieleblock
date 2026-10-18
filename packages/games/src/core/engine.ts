import type { BaseGame, ResultRow, SeatedPlayer } from './types';

export interface UndoOutcome {
  /** Feld, das die Oberfläche kurz hervorheben darf. */
  fieldId?: string;
}

/**
 * Vertrag eines Spiels. Eine Engine kennt Regeln, Zustand und Wertung, aber keine Oberfläche
 * und kein Framework. Alles Zustandsändernde arbeitet auf einer Kopie (`draft`) des Spiels und
 * darf sie frei verändern; der Speicher legt die Kopie danach ab.
 *
 * Neues Spiel: eine Engine schreiben, in `registry.ts` eintragen, in der Web-App die
 * Oberfläche dazu anmelden (siehe docs/neues-spiel.md).
 */
export interface GameEngine<G extends BaseGame = BaseGame, O = unknown> {
  readonly id: string;
  readonly higherIsBetter: boolean;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  /** Erscheint das Spiel im Entwicklungs-Diagramm? */
  readonly includeInTrend: boolean;
  readonly defaultOptions: O;
  /** Felder, die nur dieses Gerät betreffen und deshalb nicht am Live-Tisch geteilt werden. */
  readonly localKeys: readonly string[];

  normalizeOptions(raw: unknown): O;
  /**
   * Führt die Einstellungen zweier Geräte zusammen. Ohne diese Methode gilt die neuere Fassung komplett.
   * Nur nötig, wenn Einstellungen Sammlungen enthalten, die auf mehreren Geräten wachsen.
   */
  mergeOptions?(newer: O, older: O): O;
  create(players: SeatedPlayer[], options: O): G;
  /** Neues Spiel mit denselben Einstellungen. `nameOf` liefert den aktuellen Namen eines Spielers. */
  rematch(game: G, nameOf: (player: SeatedPlayer) => string): G;

  result(game: G): ResultRow[];
  /** Anzeigename inklusive Variante, z. B. „Kniffel Extreme“. */
  label(game: G): string;
  /** Spiele mit gleichem Schlüssel werden in Rekorden und Diagrammen zusammengefasst. */
  statsKey(game: G): string;
  trendLabel(game: G): string;
  progress(game: G): string;
  /** Noch nichts eingetragen? Dann wird das Spiel beim Verlassen verworfen. */
  isEmpty(game: G): boolean;
  /** Meldung, falls das Spiel jetzt nicht ausgewertet werden kann. */
  cannotFinish(game: G): string | null;
  /** Warnung vor vorzeitigem Auswerten; leer, wenn es unbedenklich ist. */
  finishWarning(game: G): string;
  endNote(game: G): string;

  /** Beschreibung des letzten Rückgängig-Schritts oder `null`. */
  describeUndo(game: G): string | null;
  undo(game: G): UndoOutcome | null;

  /** Bereinigt ein fremdes Dokument (Server, Backup, Live-Tisch) auf gültige Werte. */
  sanitize(out: G, raw: Record<string, unknown>): void;
}

export type AnyEngine = GameEngine<any, any>;
export type EngineLookup = (type: string) => AnyEngine | undefined;
