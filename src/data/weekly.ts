// Wochen-Ereignis: jede Kalenderwoche andere Galaxie-Bedingungen und ein Sonderauftrag
import type { GameState } from '../core/state';
import { COLONY_UNLOCK_PLANET } from './colonies';

export interface WeeklyMod {
  id: string;
  name: string;
  emoji: string;
  desc: string;
}

/** Wirkung: talentfx.ts (weeklyPerks) und colonies.ts (Rohstoff-Boom, Sonnensturm) */
export const WEEKLY_MODS: WeeklyMod[] = [
  { id: 'sonne', name: 'Sonnensturm', emoji: '☀️', desc: 'Solarkraftwerke in den Kolonien ×3 – aber Expeditionen haben −10 % Erfolgschance.' },
  { id: 'komet', name: 'Kometenregen', emoji: '☄️', desc: 'Kometen kommen doppelt so oft.' },
  { id: 'funk', name: 'Funkfeuer', emoji: '📡', desc: 'Funksprüche kommen doppelt so oft.' },
  { id: 'boom', name: 'Rohstoff-Boom', emoji: '⛏️', desc: 'Alle Kolonien produzieren doppelt so viel.' },
  { id: 'materie', name: 'Materie-Flut', emoji: '⚗️', desc: 'Expeditionen bringen doppelt so viel Exotische Materie.' },
  { id: 'staub', name: 'Sternschnuppen-Woche', emoji: '✨', desc: 'Supernovas bringen +25 % Sternenstaub.' },
  { id: 'industrie', name: 'Industriewoche', emoji: '🏭', desc: 'Alle Anlagen kosten 10 % weniger.' },
  { id: 'forschung', name: 'Forschungswoche', emoji: '🔬', desc: 'Forschung im Labor kostet 20 % weniger.' },
  { id: 'gipfel', name: 'Gipfeltreffen', emoji: '🤝', desc: 'Doppelter Ruf bei allen Fraktionen.' },
  { id: 'manoever', name: 'Flottenmanöver', emoji: '🚀', desc: 'Flüge sind 25 % kürzer, Kommandanten-XP ×1,5.' },
];

export interface WeeklyContract {
  id: string;
  emoji: string;
  text: string;
  goal: number;
  /** Zähler, dessen Zuwachs in dieser Woche zählt */
  stat: (s: GameState) => number;
  /** nur wählbar, wenn der Bereich schon freigeschaltet ist */
  available: (s: GameState) => boolean;
}

export const WEEKLY_CONTRACTS: WeeklyContract[] = [
  { id: 'nova', emoji: '💥', text: 'Löse 15 Supernovas aus', goal: 15, stat: (s) => s.totalSupernovas, available: () => true },
  { id: 'funk', emoji: '📡', text: 'Beantworte 10 Funksprüche', goal: 10, stat: (s) => s.stats.eventsAnswered, available: () => true },
  { id: 'komet', emoji: '☄️', text: 'Fange 40 Kometen', goal: 40, stat: (s) => s.stats.cometsTapped, available: () => true },
  { id: 'mission', emoji: '🎯', text: 'Erfülle 12 Missionen', goal: 12, stat: (s) => s.stats.questsDone, available: () => true },
  { id: 'bau', emoji: '🏗️', text: 'Schließe 20 Kolonie-Bauten ab', goal: 20, stat: (s) => s.stats.colonyBuilds, available: (s) => s.stats.bestPlanet >= COLONY_UNLOCK_PLANET || s.galaxyJumps > 0 },
  { id: 'flotte', emoji: '🚀', text: 'Schließe 8 Expeditionen ab', goal: 8, stat: (s) => s.fleet.expeditions, available: (s) => s.fleet.ships.length > 0 },
  { id: 'kraft', emoji: '⚡', text: 'Setze 12 Fähigkeiten ein', goal: 12, stat: (s) => s.stats.abilitiesUsed, available: (s) => s.commander.abilities.length > 0 },
];

export const WEEKLY_REWARD = { gems: 150, em: 300 };

/** einfacher, stabiler Zahlenwert für einen Text (Kalenderwoche → Zufall ohne Server) */
export function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bedingung der Woche (leer = noch keine Woche begonnen) */
export function weeklyModFor(key: string): WeeklyMod | null {
  return key ? WEEKLY_MODS[hashKey(key) % WEEKLY_MODS.length] : null;
}
