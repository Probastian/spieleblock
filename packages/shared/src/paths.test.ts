import { describe, expect, it } from 'vitest';
import { generateDeviceKey } from './device-key';
import { isAllowedPath, parsePath, seatPath, tablePath, userGamePath } from './paths';

describe('Pfadregeln', () => {
  const uid = '0123456789abcdef';

  it('erlaubt die Pfade, die die App selbst baut', () => {
    expect(isAllowedPath(parsePath(userGamePath(uid, 'g1')), 'doc')).toBe(true);
    expect(isAllowedPath(parsePath(`data/users/${uid}/meta/games`), 'col')).toBe(true);
    expect(isAllowedPath(parsePath(tablePath('K7P4X')), 'doc')).toBe(true);
    expect(isAllowedPath(parsePath(seatPath('K7P4X', 3)), 'doc')).toBe(true);
  });

  it('lehnt falsche Art, falsche Wurzel und fremde Zeichen ab', () => {
    expect(isAllowedPath(parsePath(tablePath('K7P4X')), 'col')).toBe(false);
    expect(isAllowedPath(parsePath('secrets/x'), 'doc')).toBe(false);
    expect(isAllowedPath(parsePath('data/users/XYZ/meta'), 'doc')).toBe(false);
    expect(parsePath('tables/../etc')).toBeNull();
    expect(parsePath('')).toBeNull();
  });

  it('erzeugt gültige Gerätekennungen', () => {
    expect(generateDeviceKey()).toMatch(/^[A-HJ-NP-Z2-9]{20}$/);
  });
});
