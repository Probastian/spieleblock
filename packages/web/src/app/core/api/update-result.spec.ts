import { describe, expect, it } from 'vitest';
import type { UpdateResponse } from '@spieleblock/shared';
import { outcomeOf } from './update-result';

const response = (checkedAt: number | null, state: 'current' | 'updated' | 'failed' = 'current'): UpdateResponse => ({
  enabled: true,
  now: 0,
  status: checkedAt === null ? null : { checkedAt, state, current: 'v2.2.0', latest: 'v2.2.0' },
});

describe('outcomeOf', () => {
  it('wartet, solange es keinen Status gibt oder er älter ist als die Anforderung', () => {
    expect(outcomeOf(response(null), 5_000_500)).toBeNull();
    expect(outcomeOf(response(4_000_000), 5_000_500)).toBeNull();
  });

  it('erkennt eine Prüfung, die in derselben Sekunde fertig wurde', () => {
    expect(outcomeOf(response(5_000_000), 5_000_500)).toBe('current');
    expect(outcomeOf(response(5_000_000), 5_000_999)).toBe('current');
  });

  it('gibt das Ergebnis des Skripts weiter', () => {
    expect(outcomeOf(response(6_000_000, 'updated'), 5_000_500)).toBe('updated');
    expect(outcomeOf(response(6_000_000, 'failed'), 5_000_500)).toBe('failed');
  });
});
