import type { UpdateResponse } from '@spieleblock/shared';

export type UpdateOutcome = 'current' | 'updated' | 'failed';

/**
 * Gehört der Status zu meiner Anforderung? Das Skript schreibt `checkedAt` auf die Sekunde genau, die Anforderung
 * trägt Millisekunden. Deshalb gilt die ganze Sekunde der Anforderung noch als „danach“, sonst ginge eine Prüfung
 * verloren, die in derselben Sekunde fertig wird.
 */
export function outcomeOf(response: UpdateResponse, requestedAt: number): UpdateOutcome | null {
  const s = response.status;
  if (!s || s.checkedAt < Math.floor(requestedAt / 1000) * 1000) return null;
  return s.state;
}
