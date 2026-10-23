// Speichern/Laden in localStorage, Backup-Slot, Export-Code
import { defaultState, hydrate, type GameState } from './state';

const KEY = 'cosmo-tycoon:save';
const BACKUP = 'cosmo-tycoon:backup';
const PREFIX = 'CT1:';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(json: string, now = Date.now()): GameState {
  return hydrate(JSON.parse(json), now);
}

let lastWritten = '';

export function saveGame(s: GameState): boolean {
  const st = storage();
  if (!st) return false;
  try {
    const json = serialize(s);
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
  const json = serialize(s);
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
