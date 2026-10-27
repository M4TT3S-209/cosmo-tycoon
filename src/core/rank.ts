// Kommandanten-Rang: XP, Level 1–100, Freischaltungen (Hangar- und Artefakt-Plätze)
import { emit } from './bus';
import { ctier, gemMult } from './economy';
import { talentBonus } from './talentfx';
import type { GameState } from './state';

export const RANK_MAX = 100;
export const RANK_TITLES = [
  'Kadett', 'Pilot', 'Leutnant', 'Kapitän', 'Commander',
  'Admiral', 'Großadmiral', 'Sternenfürst', 'Galaxie-Kaiser', 'Kosmos-Legende',
];
export const HANGAR_UNLOCKS = [5, 15, 30, 50];
export const ARTIFACT_SLOT_UNLOCKS = [10, 20, 35, 55, 75];
export const BASE_ARTIFACT_SLOTS = 3;

/** XP-Belohnungen je Ereignis */
export const XP = {
  milestone: 5,
  empire: 25,
  upgrade: 3,
  manager: 8,
  comet: 15,
  quest: 25,
  achievement: 20,
  daily: 30,
  supernova: 60,
  galaxy: 600,
  challenge: 250,
};

const XP_BASE = 60;
const XP_EXP = 1.6;

export function xpForNext(level: number): number {
  return Math.round(XP_BASE * Math.pow(level, XP_EXP));
}

export function rankTitle(level: number): string {
  return RANK_TITLES[Math.min(RANK_TITLES.length - 1, Math.floor((level - 1) / 10))];
}

export function levelGems(level: number): number {
  return 5 + Math.floor(level / 5) * 2;
}

export function fleetUnlocked(s: GameState): boolean {
  return s.totalSupernovas >= 1 || s.galaxyJumps > 0;
}

export function hangarSlots(s: GameState): number {
  return 1 + HANGAR_UNLOCKS.filter((l) => s.rank.level >= l).length + (ctier(s, 'countdown') >= 1 ? 1 : 0) + talentBonus(s).hangar;
}

export function artifactSlots(s: GameState): number {
  return BASE_ARTIFACT_SLOTS + ARTIFACT_SLOT_UNLOCKS.filter((l) => s.rank.level >= l).length + talentBonus(s).artSlots;
}

/** Fügt Schiffe für neu freigeschaltete Hangar-Plätze hinzu (entfernt nie welche) */
export function syncShips(s: GameState): void {
  const target = fleetUnlocked(s) ? hangarSlots(s) : 0;
  while (s.fleet.ships.length < target) s.fleet.ships.push({ engine: 0, cargo: 0, shield: 0 });
}

/** Was schaltet das nächste Level frei? (für die Anzeige) */
export function nextUnlock(s: GameState): string | null {
  for (let l = s.rank.level + 1; l <= RANK_MAX; l++) {
    if (HANGAR_UNLOCKS.includes(l)) return `Level ${l}: +1 Hangar-Platz`;
    if (ARTIFACT_SLOT_UNLOCKS.includes(l)) return `Level ${l}: +1 Artefakt-Platz`;
    if ((l - 1) % 10 === 0) return `Level ${l}: Rang ${rankTitle(l)}`;
  }
  return null;
}

export function addXp(s: GameState, amount: number): void {
  if (!(amount > 0) || s.rank.level >= RANK_MAX) return;
  s.rank.xp += Math.round(amount * talentBonus(s).xp);
  while (s.rank.level < RANK_MAX && s.rank.xp >= xpForNext(s.rank.level)) {
    s.rank.xp -= xpForNext(s.rank.level);
    s.rank.level++;
    const g = Math.max(1, Math.round(levelGems(s.rank.level) * gemMult(s)));
    s.gems += g;
    s.stats.gemsEarned += g;
    emit('rankUp', { level: s.rank.level, gems: g });
  }
  if (s.rank.level >= RANK_MAX) s.rank.xp = 0;
  syncShips(s);
}
