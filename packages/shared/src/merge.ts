/** Dreiwege-Merge von JSON: `base` ist der zuletzt abgeglichene Stand, `local` meiner, `remote` ihrer. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function merge3<T = unknown>(base: unknown, local: T, remote: T): T {
  return mergeValue(base, local, remote) as T;
}

function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (sameJson(local, remote)) return local;
  if (sameJson(local, base)) return remote;
  if (sameJson(remote, base)) return local;

  if (isObject(local) && isObject(remote)) {
    const b = isObject(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const inLocal = key in local;
      const inRemote = key in remote;
      if (inLocal && inRemote) out[key] = mergeValue(b[key], local[key], remote[key]);
      else if (inLocal) {
        if (key in b && sameJson(b[key], local[key])) continue; // drüben gelöscht
        out[key] = local[key];
      } else {
        if (key in b && sameJson(b[key], remote[key])) continue; // bei mir gelöscht
        out[key] = remote[key];
      }
    }
    return out;
  }

  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    const common = Math.min(local.length, remote.length);
    const head = Array.from({ length: common }, (_, i) => mergeValue(b[i], local[i], remote[i]));
    return head.concat((local.length >= remote.length ? local : remote).slice(common));
  }

  return local;
}
