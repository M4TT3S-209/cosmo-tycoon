// Simulationsschritt + periodische Automatik
import { BUILDING_COUNT } from '../data/buildings';
import { autoLab, autoLabActive, earn, nextCometDelay } from './actions';
import { autoOptions, autoSpend, autoStatus } from './autobuy';
import { buildingBlocked, compute, isManaged, type Calc } from './economy';
import { checkChallenge } from './challenges';
import { ensureColonies, tickColonies, updateColonyBuilds, updateMega } from './colonies';
import { syncAbilities } from './commander';
import { checkChains, tickEvents } from './events';
import { autoCollect, checkAchievements, ensureQuests, trackDay, updateQuests } from './meta';
import { syncWeekly } from './weekly';
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
/** Kolonie-Zeit seit dem letzten langsamen Schritt (Produktion läuft nach Wanduhr) */
let colonyDt = 0;

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

  tickEvents(s, dt, now);

  s.nextCometIn -= dt;
  if (s.nextCometIn <= 0) {
    s.nextCometIn = nextCometDelay(s);
    out.cometSpawn = true;
  }

  if (calc.income > s.stats.bestIncome) s.stats.bestIncome = calc.income;

  colonyDt += dt;
  slowTimer += dt;
  if (slowTimer >= 0.5) {
    slowTimer = 0;
    slowTick(s, now);
  }
}

/** Zweimal pro Sekunde: Automatik, Kolonien, Erfolge, Missionen */
export function slowTick(s: GameState, now: number): void {
  const auto = autoOptions(s);
  if (auto) autoSpend(s, now, auto);
  else autoStatus.target = null;
  checkChallenge(s);
  syncAbilities(s);
  checkChains(s, now);
  ensureColonies(s);
  tickColonies(s, colonyDt);
  colonyDt = 0;
  updateColonyBuilds(s, now);
  updateMega(s, now);
  if (autoSupernovaReady(s) && !s.challenge.active) supernova(s);
  if (autoLabActive(s)) autoLab(s);
  trackDay(s, now);
  syncWeekly(s, now);
  ensureQuests(s);
  updateQuests(s);
  autoCollect(s);
  checkAchievements(s);
}
