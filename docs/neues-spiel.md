# Ein neues Spiel hinzufügen

Ein Spiel besteht aus einer **Engine** (Regeln, ohne Oberfläche) und einer **Oberfläche**. Beide melden sich in je einer Liste an. Mehr braucht es nicht: Hauptmenü, Spielerauswahl, Verlauf, Statistik, Rekorde, Backup, Server-Abgleich und Live-Tisch funktionieren dann automatisch.

Als Beispiel ein Spiel `skat` (Name frei wählbar, die ID darf nur Buchstaben, Ziffern, `-`, `_` enthalten).

## 1. Engine: `packages/games/src/skat/`

`game.ts` beschreibt den Zustand und die Operationen:

```ts
import type { BaseGame, SeatedPlayer } from '../core/types';
import { newId } from '../core/util';

export interface SkatGame extends BaseGame {
  type: 'skat';
  rounds: number[][];          // Spielstand, spiel-spezifisch
  undo: { k: 'add' }[];
}

export function create(players: SeatedPlayer[]): SkatGame { /* … */ }
export function addRound(g: SkatGame, points: number[]): string { /* ändert g direkt, gibt Meldung zurück */ }
```

`engine.ts` erfüllt den Vertrag `GameEngine` (siehe `core/engine.ts`, jede Methode ist dort dokumentiert):

```ts
export const skatEngine: GameEngine<SkatGame, SkatOptions> = {
  id: 'skat',
  higherIsBetter: true,       // gewinnt, wer mehr hat? Steuert Rekorde
  minPlayers: 3, maxPlayers: 3,
  includeInTrend: true,       // Entwicklungs-Diagramm im Verlauf
  defaultOptions: { … },
  localKeys: [],              // Felder, die am Live-Tisch nicht geteilt werden
  create, rematch, result,    // result(): Rangliste mit rank() aus core/rank
  label, statsKey, trendLabel, progress, isEmpty,
  cannotFinish, finishWarning, endNote,
  describeUndo, undo,         // undo() ändert das Spiel und ruft reopenGame(g)
  sanitize,                   // fremde Daten auf gültige Werte zurückführen
  normalizeOptions,
};
```

Dann in `packages/games/src/registry.ts` in die Liste `ENGINES` eintragen und in `src/index.ts` den Namensraum exportieren (`export * as skat from './skat';`). Die Regeln lassen sich jetzt mit Vitest testen, ohne dass irgendeine Oberfläche existiert (Beispiele: `kniffel/kniffel.test.ts`).

## 2. Oberfläche: `packages/web/src/app/games/skat/`

* `skat.ui.ts`: Beschreibung für das Hauptmenü (`GameUi`, siehe `games/game-ui.ts`): Name, Beschreibung, Schlagwörter, Kachelfarbe, Symbol und Lader für die Komponenten.
* `skat-board.component.ts`: das Spielblatt. Es holt sich das Spiel mit `inject(PlayContext).typed<SkatGame>()` und verändert es mit `ctx.update(g => skat.addRound(g, …))`. `<sb-game-topbar>` liefert die Kopfleiste samt Menü und Live-Anzeige.
* `skat-setup.component.ts`: Einstellungen im Einrichtungsbildschirm (hat die Eingabe `playerCount`). Einstellungen speichert `store.setGameOptions('skat', {...})`.
* Optional: `menuExtras` (zusätzliche Menüeinträge), `endExtras` (Zusatz auf dem Ergebnis, z. B. Diagramm), Sheets für Eingaben.

Dann in `games/registry.ts` das `GameUi` in `GAME_UIS` eintragen. Fehlt zu einer Engine die Oberfläche (oder umgekehrt), bricht die App beim Start mit einer klaren Meldung ab.

## 3. Prüfen

```bash
npm run check
```

Bestehende Daten anderer Spiele bleiben unberührt: Das Datenformat kennt Spiele nur über das Feld `type`.

## Gut zu wissen

* **Alles Zustandsändernde gehört in die Engine**, nicht in die Komponente. Die Komponente ruft sie auf und zeigt eine Meldung.
* **Rückgängig** ist Aufgabe der Engine: Jede Änderung legt einen Eintrag in `undo` ab (mit `pushUndo`, begrenzt auf 60), `undo()` nimmt ihn zurück.
* **`sanitize`** läuft über alles, was von außen kommt (Server-Abgleich beim Live-Tisch, Backup-Import). Prüft Wertebereiche, Längen, Listen.
* **Live-Tisch** braucht nichts Besonderes. Nur lokale Felder (z. B. eine halb eingegebene Hand) in `localKeys` nennen.
