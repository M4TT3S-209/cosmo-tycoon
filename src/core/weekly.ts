// Wochen-Ereignis: Bedingung und Sonderauftrag der aktuellen Kalenderwoche (Version 3)
import { WEEKLY_CONTRACTS, WEEKLY_REWARD, hashKey, weeklyModFor, type WeeklyContract, type WeeklyMod } from '../data/weekly';
import { addGems } from './actions';
import { emit } from './bus';
import { emScale } from './colonies';
import { eventsUnlocked, giveArtifact } from './events';
import { addEm } from './fleet';
import { weekKey } from './meta';
import type { GameState } from './state';

/** ab der ersten Supernova (wie die Funksprüche) */
export function weeklyUnlocked(s: GameState): boolean {
  return eventsUnlocked(s);
}

export function weeklyMod(s: GameState): WeeklyMod | null {
  return weeklyUnlocked(s) ? weeklyModFor(s.weekly.key) : null;
}

export function weeklyContract(s: GameState): WeeklyContract | null {
  if (!weeklyUnlocked(s) || !s.weekly.key) return null;
  return WEEKLY_CONTRACTS.find((c) => c.id === s.weekly.contract) ?? null;
}

/** Neue Kalenderwoche → neue Bedingung, neuer Auftrag (Zählerstand von jetzt an) */
export function syncWeekly(s: GameState, now: number): boolean {
  if (!weeklyUnlocked(s)) return false;
  const key = weekKey(now);
  if (s.weekly.key === key) return false;
  const pool = WEEKLY_CONTRACTS.filter((c) => c.available(s));
  const contract = pool[hashKey(key + ':auftrag') % pool.length];
  s.weekly = { key, base: contract.stat(s), claimed: false, contract: contract.id };
  emit('weeklyNew', { key });
  emit('structure', {});
  return true;
}

export function weeklyProgress(s: GameState): number {
  const c = weeklyContract(s);
  return c ? Math.max(0, Math.min(c.goal, c.stat(s) - s.weekly.base)) : 0;
}

export function weeklyClaimable(s: GameState): boolean {
  const c = weeklyContract(s);
  return !!c && !s.weekly.claimed && weeklyProgress(s) >= c.goal;
}

export function weeklyRewardEm(s: GameState): number {
  return Math.round(WEEKLY_REWARD.em * emScale(s));
}

/** Belohnung abholen: Kristalle, Exotische Materie und ein Artefakt (mindestens selten) */
export function claimWeekly(s: GameState, rnd: () => number = Math.random): string[] | null {
  if (!weeklyClaimable(s)) return null;
  s.weekly.claimed = true;
  s.stats.weeklyDone++;
  const gems = addGems(s, WEEKLY_REWARD.gems);
  const em = weeklyRewardEm(s);
  addEm(s, em);
  const art = giveArtifact(s, 'rare', rnd);
  emit('structure', {});
  return [`+${gems} 💎`, `+${em} ⚗️`, art];
}

/** Millisekunden bis zum Wochenwechsel (Montag 0 Uhr, Ortszeit) */
export function weekEndsIn(now: number): number {
  const d = new Date(now);
  const weekday = (d.getDay() + 6) % 7;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekday + 7);
  return Math.max(0, next.getTime() - now);
}
