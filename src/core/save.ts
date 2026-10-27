// Speichern/Laden in localStorage, Backup-Slot, Export-Code
import { SAVE_VERSION, defaultState, hydrate, rawVersion, type GameState } from './state';
import { migrate } from './migrate';
import { repairNumbers } from './safe';

const KEY = 'cosmo-tycoon:save';
const BACKUP = 'cosmo-tycoon:backup';
/**
 * Unveränderte Kopie eines Spielstands der Version v vor dem Update auf die nächste große Version
 * (backup-v1 vor 2.0, backup-v2 vor 3.0 …) – wird nie überschrieben.
 */
export const preUpdateKey = (v: number): string => `cosmo-tycoon:backup-v${v}`;
const PREFIX = 'CT1:';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Spielstand als JSON. Zahlen-Schutz: ±∞ wird zu ±1e300, NaN zum zuletzt gespeicherten Wert
 * (sonst 0) – JSON würde beides als null schreiben, und beim Laden würde daraus der Standardwert.
 */
export function serialize(s: GameState, previous = ''): string {
  const repaired = repairNumbers(s, previous ? () => JSON.parse(previous) : undefined);
  if (repaired > 0) console.warn(`Zahlen-Schutz: ${repaired} Wert(e) im Spielstand repariert`);
  return JSON.stringify(s);
}

export function deserialize(json: string, now = Date.now()): GameState {
  const raw = JSON.parse(json);
  const from = rawVersion(raw);
  const s = hydrate(raw, now);
  migrate(s, from);
  return s;
}

let lastWritten = '';

export function saveGame(s: GameState): boolean {
  const st = storage();
  if (!st) return false;
  try {
    const json = serialize(s, lastWritten);
    if (lastWritten && lastWritten !== json) st.setItem(BACKUP, lastWritten);
    st.setItem(KEY, json);
    lastWritten = json;
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult {
  state: GameState;
  fresh: boolean;
  restoredFromBackup: boolean;
}

export function loadGame(now = Date.now()): LoadResult {
  const st = storage();
  if (st) {
    for (const [key, backup] of [[KEY, false], [BACKUP, true]] as const) {
      try {
        const raw = st.getItem(key);
        if (!raw) continue;
        // vor der ersten Migration eine unveränderte Kopie des alten Stands ablegen
        const v = rawVersion(JSON.parse(raw));
        if (v < SAVE_VERSION && !st.getItem(preUpdateKey(v))) {
          st.setItem(preUpdateKey(v), raw);
        }
        const state = deserialize(raw, now);
        lastWritten = raw;
        return { state, fresh: false, restoredFromBackup: backup };
      } catch {
        // nächsten Slot versuchen
      }
    }
  }
  return { state: defaultState(now), fresh: true, restoredFromBackup: false };
}

/** Neueste vorhandene Sicherung von vor einem Update (Rohtext + Version) */
function latestPreUpdate(): { raw: string; version: number } | null {
  try {
    const st = storage();
    for (let v = SAVE_VERSION - 1; v >= 1; v--) {
      const raw = st?.getItem(preUpdateKey(v));
      if (raw) return { raw, version: v };
    }
  } catch {
    /* nicht verfügbar */
  }
  return null;
}

/** Gibt es eine unveränderte Sicherung von vor einem Update? Liefert deren Spielstand-Version. */
export function hasPreUpdateBackup(): number {
  return latestPreUpdate()?.version ?? 0;
}

/** Lädt die neueste Sicherung von vor einem Update (wird dabei erneut migriert, die Sicherung bleibt bestehen) */
export function loadPreUpdateBackup(now = Date.now()): GameState | null {
  const b = latestPreUpdate();
  return b ? deserialize(b.raw, now) : null;
}

export function wipeSave(): void {
  const st = storage();
  if (!st) return;
  try {
    st.removeItem(KEY);
    st.removeItem(BACKUP);
  } catch {
    /* ignorieren */
  }
  lastWritten = '';
}

// ---- Export / Import --------------------------------------------------------

function checksum(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function exportCode(s: GameState): string {
  const json = serialize(s, lastWritten);
  return PREFIX + checksum(json) + ':' + toBase64(json);
}

export function importCode(code: string, now = Date.now()): GameState {
  const trimmed = code.trim().replace(/\s+/g, '');
  if (!trimmed.startsWith(PREFIX)) throw new Error('Das ist kein Cosmo-Tycoon-Code.');
  const rest = trimmed.slice(PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep < 0) throw new Error('Der Code ist unvollständig.');
  const sum = rest.slice(0, sep);
  let json: string;
  try {
    json = fromBase64(rest.slice(sep + 1));
  } catch {
    throw new Error('Der Code ist beschädigt.');
  }
  if (checksum(json) !== sum) throw new Error('Der Code ist beschädigt (Prüfsumme falsch).');
  return deserialize(json, now);
}
