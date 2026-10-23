// Erfolge, Missionen, tägliche Belohnung, Offline-Einnahmen
import { ACHIEVEMENTS } from '../data/achievements';
import { BUILDINGS, BUILDING_COUNT } from '../data/buildings';
import { DAILY, type DailyReward } from '../data/daily';
import { UPGRADES } from '../data/upgrades';
import { addGems, earn, grantBoost, timeWarp } from './actions';
import { emit } from './bus';
import { compute, managerCost, newCalc, nextMilestone, offlineCapSec, offlineEfficiency } from './economy';
import { fmt } from './format';
import type { GameState, Quest, QuestType } from './state';

// ---- Erfolge ----------------------------------------------------------------

export function checkAchievements(s: GameState): number {
  let n = 0;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    const [cur, goal] = a.progress(s);
    if (cur >= goal) {
      s.achievements[a.id] = true;
      addGems(s, a.gems);
      emit('achievement', { def: a });
      n++;
    }
  }
  return n;
}

// ---- Missionen ----------------------------------------------------------------

const scratch = newCalc();

function niceRound(n: number): number {
  if (n < 10) return Math.max(1, Math.round(n));
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

function highestOwned(s: GameState): number {
  let h = 0;
  for (let i = 0; i < BUILDING_COUNT; i++) if (s.buildings[i].owned > 0) h = i;
  return h;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function questProgress(s: GameState, q: Quest): [number, number] {
  switch (q.type) {
    case 'buy': return [s.stats.boughtBy[q.target] - q.base, q.goal];
    case 'earn': return [s.totalEarnings - q.base, q.goal];
    case 'comet': return [s.stats.cometsTapped - q.base, q.goal];
    case 'upgrade': return [s.stats.upgradesBought - q.base, q.goal];
    case 'tap': return [s.stats.taps - q.base, q.goal];
    case 'milestone': return [s.buildings[q.target].owned, q.goal];
    case 'manager': return [s.managers[q.target] ? 1 : 0, 1];
  }
}

export function questText(q: Quest): string {
  const b = q.target >= 0 ? BUILDINGS[q.target] : null;
  switch (q.type) {
    case 'buy': return `Kaufe ${q.goal} × ${b!.emoji} ${b!.name}`;
    case 'earn': return `Verdiene ${fmt(q.goal)} 🪙`;
    case 'comet': return q.goal === 1 ? 'Fange einen goldenen Kometen ☄️' : `Fange ${q.goal} goldene Kometen ☄️`;
    case 'upgrade': return q.goal === 1 ? 'Kaufe ein Upgrade' : `Kaufe ${q.goal} Upgrades`;
    case 'tap': return `Tippe ${q.goal} mal auf Anlagen`;
    case 'milestone': return `Bringe ${b!.emoji} ${b!.name} auf ${q.goal}`;
    case 'manager': return `Stelle den Manager für ${b!.emoji} ${b!.name} ein`;
  }
}

export function genQuest(s: GameState, exclude: QuestType[]): Quest {
  const c = compute(s, Date.now(), scratch);
  const hi = highestOwned(s);
  const options: QuestType[] = ['buy', 'earn', 'comet'];
  if (UPGRADES.some((u) => !s.upgrades[u.id] && u.cost < Math.max(s.cash, c.potential * 1800) * 3)) options.push('upgrade');
  if (s.buildings.some((b, i) => b.owned > 0 && !s.managers[i])) options.push('tap');
  options.push('milestone');
  const mgrTarget = s.managers.findIndex((m, i) => !m && s.buildings[i].owned > 0 && managerCost(i) < Math.max(s.cash, c.potential * 1200) * 4);
  if (mgrTarget >= 0) options.push('manager');
  const pool = options.filter((t) => !exclude.includes(t));
  const type = pick(pool.length ? pool : options);
  const id = ++s.questSeq;
  const reward = 3 + Math.floor(Math.random() * 4) + Math.min(6, Math.floor(s.stats.questsDone / 8));
  const q: Quest = { id, type, target: -1, goal: 1, base: 0, reward, done: false };
  switch (type) {
    case 'buy': {
      const t = Math.floor(Math.random() * (hi + 1));
      q.target = t;
      q.goal = Math.max(5, Math.min(100, Math.round((s.buildings[t].owned * 0.3) / 5) * 5));
      q.base = s.stats.boughtBy[t];
      break;
    }
    case 'earn': {
      const rate = Math.max(c.potential, 1);
      q.goal = niceRound(Math.max(500, rate * (240 + Math.random() * 480)));
      q.base = s.totalEarnings;
      break;
    }
    case 'comet':
      q.goal = 1 + Math.floor(Math.random() * 2);
      q.base = s.stats.cometsTapped;
      q.reward += 2;
      break;
    case 'upgrade':
      q.goal = 1 + Math.floor(Math.random() * 2);
      q.base = s.stats.upgradesBought;
      break;
    case 'tap':
      q.goal = 20 + Math.floor(Math.random() * 5) * 10;
      q.base = s.stats.taps;
      break;
    case 'milestone': {
      const t = Math.floor(Math.random() * (hi + 1));
      q.target = t;
      q.goal = nextMilestone(s.buildings[t].owned) ?? s.buildings[t].owned + 100;
      q.reward += 1;
      break;
    }
    case 'manager':
      q.target = mgrTarget;
      q.goal = 1;
      break;
  }
  return q;
}

export function ensureQuests(s: GameState): void {
  while (s.quests.length < 3) {
    s.quests.push(genQuest(s, s.quests.map((q) => q.type)));
  }
}

/** Nach einer Supernova: unerledigte Missionen neu würfeln (Ziele passen sonst nicht mehr) */
export function regenerateQuests(s: GameState): void {
  s.quests = s.quests.filter((q) => q.done);
  ensureQuests(s);
}

export function updateQuests(s: GameState): void {
  for (const q of s.quests) {
    if (q.done) continue;
    const [cur, goal] = questProgress(s, q);
    if (cur >= goal) {
      q.done = true;
      emit('questDone', { id: q.id });
    }
  }
}

export function claimQuest(s: GameState, id: number): number {
  const idx = s.quests.findIndex((q) => q.id === id && q.done);
  if (idx < 0) return 0;
  const q = s.quests[idx];
  const n = addGems(s, q.reward);
  s.stats.questsDone++;
  const others = s.quests.filter((x) => x.id !== id).map((x) => x.type);
  s.quests[idx] = genQuest(s, [...others, q.type]);
  emit('structure', {});
  return n;
}

// ---- Tägliche Belohnung ----------------------------------------------------------

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function canClaimDaily(s: GameState, now: number): boolean {
  return s.daily.last !== dayKey(now);
}

/** Welcher Tag (1–7) wäre die nächste Belohnung? */
export function nextDailyDay(s: GameState, now: number): number {
  const yesterday = dayKey(now - 86400000);
  if (s.daily.last === yesterday) return (s.daily.streak % 7) + 1;
  if (s.daily.last === dayKey(now)) return s.daily.streak;
  return 1;
}

export function claimDaily(s: GameState, now: number): DailyReward | null {
  if (!canClaimDaily(s, now)) return null;
  const day = nextDailyDay(s, now);
  s.daily.streak = day;
  s.daily.last = dayKey(now);
  const r = DAILY[day - 1];
  if (r.gems) addGems(s, r.gems);
  if (r.boost) grantBoost(s, r.boost, now);
  if (r.warp) timeWarp(s, r.warp, now);
  emit('structure', {});
  return r;
}

export function trackDay(s: GameState, now: number): void {
  const k = dayKey(now);
  if (s.stats.lastDay !== k) {
    s.stats.lastDay = k;
    s.stats.daysPlayed++;
  }
}

// ---- Offline ----------------------------------------------------------------

export interface OfflineResult {
  seconds: number;
  counted: number;
  amount: number;
  capped: boolean;
}

export function computeOffline(s: GameState, seconds: number, now: number): OfflineResult {
  const cap = offlineCapSec(s);
  const counted = Math.min(seconds, cap);
  const c = compute(s, now, scratch);
  const amount = c.baseIncome * counted * offlineEfficiency(s);
  return { seconds, counted, amount, capped: seconds > cap };
}

export function applyOffline(s: GameState, r: OfflineResult, mult = 1): void {
  earn(s, r.amount * mult);
}
