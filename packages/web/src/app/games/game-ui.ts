import type { Type } from '@angular/core';
import type { IconName } from '../shared/ui/icon.component';

/**
 * Oberfläche eines Spiels. Die Regeln selbst stecken in der Engine (`@spieleblock/games`); hier steht,
 * wie das Spiel im Hauptmenü aussieht und welche Komponenten es zeigt. Komponenten werden erst bei
 * Bedarf geladen, so wächst die Startgröße nicht mit jedem neuen Spiel.
 */
export interface GameUi {
  /** Gleich der Engine-ID. */
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly tags: readonly string[];
  /** Hintergrund der Kachel (CSS-Farbe). */
  readonly tile: string;
  readonly icon: IconName | 'die5';
  readonly startLabel: string;
  /** Text des Knopfs auf dem Endbildschirm, der zurück zum Blatt führt. */
  readonly reviewLabel?: string;
  /** Spiel-spezifische Einstellungen im Einrichtungsbildschirm. Bekommt `playerCount`. */
  readonly setup: () => Promise<Type<unknown>>;
  /** Das Spielblatt. Bekommt keine Eingaben, es holt sich das Spiel über `PlayContext`. */
  readonly board: () => Promise<Type<unknown>>;
  /** Zusätzliche Einträge im Spielmenü (z. B. Regeln). */
  readonly menuExtras?: () => Promise<Type<unknown>>;
  /** Zusatzinhalt auf dem Endbildschirm (z. B. Diagramm). */
  readonly endExtras?: () => Promise<Type<unknown>>;
}
