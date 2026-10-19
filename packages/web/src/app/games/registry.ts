import { ENGINES } from '@spieleblock/games';
import type { GameUi } from './game-ui';
import { hitsterUi } from './hitster/hitster.ui';
import { filmUi } from './film/film.ui';
import { hiloUi } from './hilo/hilo.ui';
import { imposterUi } from './imposter/imposter.ui';
import { kniffelUi } from './kniffel/kniffel.ui';
import { tafelUi } from './tafel/tafel.ui';
import { wavelengthUi } from './wavelength/wavelength.ui';
import { whoamiUi } from './whoami/whoami.ui';
import { wizardUi } from './wizard/wizard.ui';

/**
 * Alle Spiele der Oberfläche, in der Reihenfolge des Hauptmenüs.
 * Ein neues Spiel: Engine in `packages/games` anlegen, hier die Oberfläche eintragen.
 */
export const GAME_UIS: readonly GameUi[] = [kniffelUi, wizardUi, hitsterUi, filmUi, imposterUi, whoamiUi, wavelengthUi, hiloUi, tafelUi];

const byId = new Map(GAME_UIS.map(ui => [ui.id, ui]));

export const uiOf = (type: string): GameUi | undefined => byId.get(type);

// Jede Engine braucht eine Oberfläche und umgekehrt – sonst fällt es sofort beim Start auf.
for (const engine of ENGINES) if (!byId.has(engine.id)) throw new Error(`Spiel „${engine.id}“ hat keine Oberfläche (games/registry.ts)`);
for (const ui of GAME_UIS) if (!ENGINES.some(e => e.id === ui.id)) throw new Error(`Oberfläche „${ui.id}“ hat keine Engine (packages/games/src/registry.ts)`);
