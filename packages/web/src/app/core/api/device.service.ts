import { Injectable } from '@angular/core';
import { formatDeviceKey, generateDeviceKey, isDeviceKey, normalizeDeviceKey } from '@spieleblock/shared';
import { readText, removeKey, writeText } from '../util/storage';

const LS_KEY = 'sb.key';
const LS_UID = 'sb.pub';

/** Gerätekennung dieses Browsers (geheim) und die daraus abgeleitete öffentliche Nutzer-ID (vom Server berechnet). */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  readonly key: string;
  private cachedUid: string | null;

  constructor() {
    let key = readText(LS_KEY);
    if (!key || !isDeviceKey(key)) {
      key = generateDeviceKey();
      writeText(LS_KEY, key);
    }
    this.key = key;
    this.cachedUid = readText(LS_UID);
  }

  /** In Fünferblöcken, zum Abschreiben. */
  get displayKey(): string {
    return formatDeviceKey(this.key);
  }

  get uid(): string | null {
    return this.cachedUid;
  }

  rememberUid(uid: string): void {
    this.cachedUid = uid;
    writeText(LS_UID, uid);
  }

  /** Übernimmt die Kennung eines anderen Geräts und lädt neu. `false`, wenn sie ungültig ist. */
  adoptKey(input: string): boolean {
    const key = normalizeDeviceKey(input);
    if (!isDeviceKey(key)) return false;
    if (key !== this.key) {
      writeText(LS_KEY, key);
      removeKey(LS_UID);
    }
    setTimeout(() => location.reload(), 150);
    return true;
  }
}
