// Simulationsschritt + periodische Automatik
import { BUILDING_COUNT } from '../data/buildings';
import { MANAGERS } from '../data/managers';
import { UPGRADES } from '../data/upgrades';
import { buyBuilding, earn, hireManager, buyUpgrade, nextCometDelay } from './actions';
import { buildingBlocked, buildingCost, chalActive, compute, isManaged, lab, type Calc } from './economy';
import { checkChallenge } from './challenges';
import { checkAchievements, ensureQuests, trackDay, updateQuests } from './meta';
import { autoSupernovaReady, supernova } from './prestige';
import type { GameState } from './state';

export interface TickOut {
  /** verdientes Geld je Anlage in diesem Schritt */
  earned: number[];
  /** abgeschlossene Zyklen je Anlage */
  cycles: number[];
  cometSpawn: boolean;
}

export function newTickOut(): TickOut {
  return { earned: Array(BUILDING_COUNT).fill(0), cycles: Array(BUILDING_COUNT).fill(0), cometSpawn: false };
}

let slowTimer = 0;

export function tick(s: GameState, dt: number, now: number, calc: Calc, out: TickOut): void {
  out.earned.fill(0);
  out.cycles.fill(0);
  out.cometSpawn = false;

  s.runTime += dt;
  s.stats.playTime += dt;
  s.lastActive = now;

  compute(s, now, calc);

  for (let i = 0; i < BUILDING_COUNT; i++) {
    const b = s.buildings[i];
    if (b.owned <= 0) continue;
    const t = calc.time[i];
    if (buildingBlocked(s, i)) continue;
    if (isManaged(s, i)) {
      b.progress += dt / t;
      if (b.progress >= 1) {
        const k = Math.floor(b.progress);
        b.progress -= k;
        const amount = k * calc.rev[i];
        earn(s, amount);
        out.earned[i] += amount;
        out.cycles[i] += k;
      }
    } else if (b.running) {
      b.progress += dt / t;
      if (b.progress >= 1) {
        b.progress = 0;
        b.running = false;
        earn(s, calc.rev[i]);
        out.earned[i] += calc.rev[i];
        out.cycles[i] += 1;
      }
    }
  }

  s.nextCometIn -= dt;
  if (s.nextCometIn <= 0) {
    s.nextCometIn = nextCometDelay(s);
    out.cometSpawn = true;
  }

  if (calc.income > s.stats.bestIncome) s.stats.bestIncome = calc.income;

  slowTimer += dt;
  if (slowTimer >= 0.5) {
    slowTimer = 0;
    slowTick(s, now);
  }
}

/** Zweimal pro Sekunde: Automatik, Erfolge, Missionen */
export function slowTick(s: GameState, now: number): void {
  if (lab(s, 'autoupgrade') > 0 && s.settings.autoUpgrade) autoUpgrade(s);
  if (lab(s, 'autobuy') > 0 && s.settings.autoBuy) autoBuy(s);
  checkChallenge(s);
  if (autoSupernovaReady(s) && !s.challenge.active) supernova(s);
  trackDay(s, now);
  ensureQuests(s);
  updateQuests(s);
  checkAchievements(s);
}

export function autoUpgrade(s: GameState): void {
  for (let i = 0; i < BUILDING_COUNT; i++) {
    if (!s.managers[i] && s.buildings[i].owned > 0 && MANAGERS[i].cost <= s.cash) hireManager(s, i);
  }
  if (chalActive(s, 'noupg')) return;
  for (const u of UPGRADES) {
    if (s.upgrades[u.id]) continue;
    if (u.cost > s.cash) break;
    buyUpgrade(s, u.id);
  }
}

/** Kauft die günstigste Anlage, solange sie höchstens 25 % des Geldes kostet */
export function autoBuy(s: GameState): void {
  for (let n = 0; n < 40; n++) {
    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < BUILDING_COUNT; i++) {
      // nur freigeschaltete + die nächste noch nicht gekaufte Anlage
      if (s.buildings[i].owned === 0 && i > 0 && s.buildings[i - 1].owned === 0) continue;
      if (buildingBlocked(s, i)) continue;
      const c = buildingCost(s, i, 1);
      if (c < bestCost) {
        bestCost = c;
        best = i;
      }
    }
    if (best < 0 || bestCost > s.cash * 0.25) return;
    buyBuilding(s, best, 1);
  }
}
