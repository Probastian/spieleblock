/**
 * Gerätekennung: ein zufälliges Geheimnis pro Browser. Aus ihr leitet der Server die öffentliche
 * Nutzer-ID ab; die Kennung selbst verlässt das Gerät nur als Header zum eigenen Server.
 * Ohne die Zeichen I und O, damit sich nichts verwechseln lässt.
 */
export const DEVICE_KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEVICE_KEY_LENGTH = 20;

const DEVICE_KEY_RE = /^[A-Z2-9]{20}$/;

export function isDeviceKey(key: unknown): key is string {
  return typeof key === 'string' && DEVICE_KEY_RE.test(key) && !/[IO]/.test(key);
}

/** Macht aus Eingaben wie „abcde-fghjk …“ eine vergleichbare Kennung. */
export function normalizeDeviceKey(input: unknown): string {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Gruppiert in Fünferblöcke zur Anzeige. */
export function formatDeviceKey(key: string): string {
  return key.match(/.{1,5}/g)?.join('-') ?? key;
}

export function generateDeviceKey(): string {
  const bytes = new Uint8Array(DEVICE_KEY_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  // 256 ist durch 32 teilbar, die Verteilung bleibt gleichmäßig
  return Array.from(bytes, b => DEVICE_KEY_ALPHABET[b % DEVICE_KEY_ALPHABET.length]).join('');
}
