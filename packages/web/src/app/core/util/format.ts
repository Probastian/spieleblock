export function formatDateTime(t: number): string {
  try {
    return new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatToday(): string {
  try {
    return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return 'Spieleabend';
  }
}

export function timeAgo(t: number, now = Date.now()): string {
  const minutes = Math.round((now - t) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`;
}

export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => [...w][0] ?? '')
    .join('')
    .toUpperCase() || '?';

export const shortName = (s: string): string => (s.length > 8 ? s.slice(0, 7) + '…' : s);

export const todayStamp = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
