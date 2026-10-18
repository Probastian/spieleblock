import type { AnyEngine } from './core/engine';
import { hitsterEngine } from './hitster/engine';
import { kniffelEngine } from './kniffel/engine';
import { tafelEngine } from './tafel/engine';
import { wizardEngine } from './wizard/engine';

/**
 * Alle Spiele. Die Reihenfolge bestimmt die Reihenfolge im Hauptmenü.
 * Ein neues Spiel wird hier eingetragen, mehr braucht dieses Paket nicht.
 */
export const ENGINES: readonly AnyEngine[] = [kniffelEngine, wizardEngine, hitsterEngine, tafelEngine];

const byId = new Map<string, AnyEngine>(ENGINES.map(e => [e.id, e]));

export const engineOf = (type: string): AnyEngine | undefined => byId.get(type);

export function requireEngine(type: string): AnyEngine {
  const engine = byId.get(type);
  if (!engine) throw new Error(`Unbekanntes Spiel: ${type}`);
  return engine;
}
