import type { EngineLookup } from './engine';
import type { BaseGame } from './types';

/**
 * Beendet ein Spiel und prüft, ob es einen neuen Rekord für diese Spielart gibt.
 * `others` sind die übrigen beendeten Spiele.
 */
export function finishGame(game: BaseGame, others: BaseGame[], engineOf: EngineLookup, now = Date.now()): void {
  const engine = engineOf(game.type);
  game.status = 'finished';
  game.finishedAt = now;
  game.record = null;
  if (!engine?.higherIsBetter) return;

  const key = engine.statsKey(game);
  const best = Math.max(...engine.result(game).map(r => r.total));
  const earlier = others.filter(o => o.id !== game.id && engineOf(o.type)?.statsKey(o) === key);
  if (!earlier.length) return;
  const prev = Math.max(...earlier.flatMap(o => engineOf(o.type)!.result(o).map(r => r.total)));
  if (best > prev) game.record = { best, prev };
}

/** Nimmt ein beendetes Spiel wieder auf (nach „Rückgängig“). */
export function reopenGame(game: BaseGame): void {
  if (game.status !== 'finished') return;
  game.status = 'active';
  delete game.finishedAt;
  game.record = null;
}
