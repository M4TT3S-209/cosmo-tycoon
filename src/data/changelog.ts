// Versionsnummer und Änderungen je Version – daraus entsteht der Hinweis nach einem Update
import type { GameState } from '../core/state';

export const APP_VERSION = '3.1.3';

export interface ChangeEntry {
  version: string;
  items: string[];
}

/** Neuerungen seit 3.0 (3.0 selbst hat einen eigenen, großen Dialog in ui/tutorial.ts) */
export const CHANGELOG: ChangeEntry[] = [
  {
    version: '3.1.0',
    items: ['🤖 <b>Kristall-Sammler:</b> Holt fertige Missionen automatisch ab. Ab dem ersten Galaxie-Sprung für 20.000 💎 im Kristall-Shop (Mehr → 💎 Shop), an/aus unter ⚙️.'],
  },
  {
    version: '3.1.1',
    items: ['💎 <b>Kristall-Kometen</b> kommen öfter (15 % statt 10 % aller Kometen) und bringen etwa zehnmal so viele Kristalle – mit steigendem Kommandanten-Level noch mehr.'],
  },
  {
    version: '3.1.2',
    items: ['📦 <b>Notvorrat:</b> Fördert keine Kolonie Metall oder Kristall, wird automatisch auf 200 bzw. 100 aufgefüllt – genug für Mine, Kristallbohrer und Solarkraftwerk. Kolonien lassen sich erst ausbauen, wenn alle Bauplätze bebaut sind.'],
  },
  {
    version: '3.1.3',
    items: ['🔔 <b>Update-Hinweis:</b> Nach jedem Update zeigt dir diese Nachricht, was neu ist. Außerdem sucht die App jetzt auch beim Zurückwechseln nach Updates, nicht nur beim Neustart.'],
  },
];

/** a > b für Versionen wie "3.1.2" */
export function versionNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Version, ab der der Update-Hinweis rechnet (ältere Stände kennen `seenVersion` noch nicht) */
export function seenVersionOf(s: GameState): string {
  if (s.seenVersion) return s.seenVersion;
  return s.tutorial.flags.v31intro ? '3.1.0' : '3.0.0';
}

/** alle Änderungen nach Version `from` (bis zur aktuellen) */
export function changesSince(from: string): ChangeEntry[] {
  return CHANGELOG.filter((e) => versionNewer(e.version, from) && !versionNewer(e.version, APP_VERSION));
}
