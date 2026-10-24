// Zahlen-Schutz: JavaScript rechnet nur bis etwa 1,8e308. Darüber wird ein Wert „unendlich“ –
// das Spiel kann einfrieren, und im Speicherstand landet statt der Zahl ein leerer Wert (null),
// der beim nächsten Laden zur 0 würde. Deshalb wird überall mit Abstand bei 1e300 gedeckelt.
import { emit } from './bus';

export const MAX_VALUE = 1e300;

/** Deckelt auf ±MAX_VALUE; NaN wird zu 0 */
export function cap(x: number): number {
  if (x > MAX_VALUE) return MAX_VALUE;
  if (x < -MAX_VALUE) return -MAX_VALUE;
  return x === x ? x : 0;
}

let capAnnounced = false;
/** Einmal pro Sitzung melden, dass das Geld an der Obergrenze angekommen ist */
export function noteCap(): void {
  if (capAnnounced) return;
  capAnnounced = true;
  emit('numberCap', {});
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Repariert nicht-endliche Zahlen in einem Spielstand (rekursiv, an Ort und Stelle):
 * ±∞ → ±MAX_VALUE, NaN → Wert an derselben Stelle in `fallback()` (z. B. der letzte Speicherstand) oder 0.
 * Gibt die Zahl der Reparaturen zurück.
 */
export function repairNumbers(obj: unknown, fallback?: () => unknown): number {
  let repairs = 0;
  let fb: unknown;
  let fbLoaded = false;
  const lookup = (path: (string | number)[]): number | null => {
    if (!fbLoaded) {
      fbLoaded = true;
      try {
        fb = fallback?.();
      } catch {
        fb = undefined;
      }
    }
    let cur: unknown = fb;
    for (const k of path) {
      if (!isPlain(cur)) return null;
      cur = (cur as Record<string | number, unknown>)[k];
    }
    return typeof cur === 'number' && Number.isFinite(cur) ? cur : null;
  };
  const walk = (node: Record<string | number, unknown>, path: (string | number)[]) => {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'number') {
        if (Number.isFinite(v)) continue;
        repairs++;
        node[k] = v === v ? (v > 0 ? MAX_VALUE : -MAX_VALUE) : (lookup([...path, k]) ?? 0);
      } else if (isPlain(v)) walk(v as Record<string | number, unknown>, [...path, k]);
    }
  };
  if (isPlain(obj)) walk(obj as Record<string | number, unknown>, []);
  return repairs;
}
