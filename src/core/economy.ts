// Reine Formeln: Kosten, Multiplikatoren, Einkommen. Kein DOM.
import { BUILDINGS, MILESTONES, EMPIRE_MILESTONES, BUILDING_COUNT } from '../data/buildings';
import { MANAGERS } from '../data/managers';
import { UPGRADES } from '../data/upgrades';
import { PLANETS, PLANET_MULT } from '../data/planets';
import { START_CASH } from '../data/lab';
import type { GameState, BuyMode } from './state';

// ---- Balancing-Konstanten -------------------------------------------------
/**
 * Sternenstaub-Kurve: log10(✨) als stückweise lineare Funktion von log10(Lauf-Einnahmen).
 * Flach am Anfang (dort wachsen die Einnahmen explosiv), steiler später – so bleibt der
 * Fortschritt über viele Supernovas gleichmäßig statt zu explodieren.
 */
export const DUST_CURVE: [number, number][] = [[6, 0], [9, 1], [14, 1.48], [20.5, 2.51]];
const DUST_TAIL_SLOPE = 0.276;

function dustCurve(x: number): number {
  const c = DUST_CURVE;
  if (x <= c[0][0]) return c[0][1] + (x - c[0][0]) * ((c[1][1] - c[0][1]) / (c[1][0] - c[0][0]));
  for (let i = 1; i < c.length; i++) {
    if (x <= c[i][0]) {
      const [x0, y0] = c[i - 1];
      const [x1, y1] = c[i];
      return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  const [xl, yl] = c[c.length - 1];
  return yl + (x - xl) * DUST_TAIL_SLOPE;
}

function dustCurveInverse(y: number): number {
  const c = DUST_CURVE;
  if (y <= c[0][1]) return c[0][0] + (y - c[0][1]) / ((c[1][1] - c[0][1]) / (c[1][0] - c[0][0]));
  for (let i = 1; i < c.length; i++) {
    if (y <= c[i][1]) {
      const [x0, y0] = c[i - 1];
      const [x1, y1] = c[i];
      return x0 + ((y - y0) * (x1 - x0)) / (y1 - y0);
    }
  }
  const [xl, yl] = c[c.length - 1];
  return xl + (y - yl) / DUST_TAIL_SLOPE;
}

export const QUANTUM_BASE = 1e5; // ✨ für 1 ⚛️ (Wurzel)
export const STARDUST_BONUS = 0.02; // +2 % pro verdientem ✨
export const ACHIEVEMENT_BONUS = 0.01; // +1 % pro Erfolg
export const QUANTUM_PASSIVE = 0.25; // +25 % pro verdientem ⚛️

export const lab = (s: GameState, id: string): number => s.lab[id] ?? 0;
export const qlvl = (s: GameState, id: string): number => s.qperks[id] ?? 0;

export function milestoneCount(owned: number): number {
  let c = 0;
  for (const m of MILESTONES) if (owned >= m) c++;
  return c;
}

export function nextMilestone(owned: number): number | null {
  for (const m of MILESTONES) if (owned < m) return m;
  return null;
}

export function prevMilestone(owned: number): number {
  let p = 0;
  for (const m of MILESTONES) if (owned >= m) p = m;
  return p;
}

export function minOwned(s: GameState): number {
  let m = Infinity;
  for (const b of s.buildings) m = Math.min(m, b.owned);
  return m;
}

export function empireCount(s: GameState): number {
  const m = minOwned(s);
  let c = 0;
  for (const e of EMPIRE_MILESTONES) if (m >= e) c++;
  return c;
}

export function nextEmpireMilestone(s: GameState): number | null {
  const m = minOwned(s);
  for (const e of EMPIRE_MILESTONES) if (m < e) return e;
  return null;
}

export function empireMultPer(s: GameState): number {
  return 2 + lab(s, 'milestone') * 0.25;
}

export function costDiscount(s: GameState): number {
  return Math.pow(0.95, lab(s, 'discount'));
}

/** Kosten für n Stück ab dem aktuellen Bestand */
export function buildingCost(s: GameState, i: number, n: number): number {
  const d = BUILDINGS[i];
  const r = d.costMult;
  const k = s.buildings[i].owned;
  return d.baseCost * Math.pow(r, k) * ((Math.pow(r, n) - 1) / (r - 1)) * costDiscount(s);
}

/** Wie viele Stück sind mit `cash` maximal bezahlbar? */
export function maxAffordable(s: GameState, i: number, cash: number): number {
  const d = BUILDINGS[i];
  const r = d.costMult;
  const first = d.baseCost * Math.pow(r, s.buildings[i].owned) * costDiscount(s);
  if (cash < first) return 0;
  const n = Math.floor(Math.log((cash * (r - 1)) / first + 1) / Math.log(r));
  // Gleitkomma-Korrektur
  let m = Math.max(0, n);
  while (m > 0 && buildingCost(s, i, m) > cash) m--;
  while (buildingCost(s, i, m + 1) <= cash) m++;
  return m;
}

/** Anzahl für einen Kauf je nach Modus (0 = bis zum nächsten Meilenstein, -1 = Max) */
export function buyAmount(s: GameState, i: number, mode: BuyMode): number {
  if (mode === -1) return Math.max(1, maxAffordable(s, i, s.cash));
  if (mode === 0) {
    const next = nextMilestone(s.buildings[i].owned);
    return next === null ? 1 : next - s.buildings[i].owned;
  }
  return mode;
}

export function managerCost(i: number): number {
  return MANAGERS[i].cost;
}

export function planetFor(s: GameState): number {
  let p = 0;
  for (let i = 0; i < PLANETS.length; i++) if (s.stardustEarned >= PLANETS[i].need) p = i;
  return Math.max(p, Math.min(PLANETS.length - 1, qlvl(s, 'qstart')));
}

export function achievementCount(s: GameState): number {
  let c = 0;
  for (const k in s.achievements) if (s.achievements[k]) c++;
  return c;
}

export function gemMult(s: GameState): number {
  return (1 + 0.25 * lab(s, 'gemfinder')) * (1 + 0.5 * qlvl(s, 'qgems'));
}

export function boostDurationMult(s: GameState): number {
  return 1 + 0.25 * lab(s, 'boostlen');
}

export function offlineCapSec(s: GameState): number {
  return (2 + 2 * lab(s, 'offtime')) * 3600;
}

export function offlineEfficiency(s: GameState): number {
  return Math.min(1, 0.5 + 0.1 * lab(s, 'offeff'));
}

export function startCash(s: GameState): number {
  return Math.max(4, START_CASH(lab(s, 'startcash')));
}

export function dustMult(s: GameState): number {
  return (1 + 0.15 * lab(s, 'snboost')) * Math.pow(1.5, qlvl(s, 'qdust'));
}

/** Sternenstaub, den eine Supernova jetzt bringen würde */
export function pendingStardust(s: GameState): number {
  return Math.floor(stardustExact(s));
}

/** ungerundeter Wert (für Fortschrittsanzeige) */
export function stardustExact(s: GameState): number {
  if (s.runEarnings < 1) return 0;
  return Math.pow(10, dustCurve(Math.log10(s.runEarnings))) * dustMult(s);
}

/** Lauf-Einnahmen, die für `p` ✨ nötig sind */
export function earningsForDust(s: GameState, p: number): number {
  if (p <= 0) return 0;
  return Math.pow(10, dustCurveInverse(Math.log10(p / dustMult(s))));
}

/** Lauf-Einnahmen, die für den nächsten ✨ nötig sind */
export function earningsForNextDust(s: GameState): number {
  return earningsForDust(s, pendingStardust(s) + 1);
}

export function pendingQuantum(s: GameState): number {
  return Math.floor(Math.sqrt(s.stardustEarned / QUANTUM_BASE));
}

export function canGalaxyJump(s: GameState): boolean {
  return s.planet >= PLANETS.length - 1 && pendingQuantum(s) >= 1;
}

/** Bonus-Teile des dauerhaften Multiplikators (für Statistik/Anzeige) */
export interface MultBreakdown {
  lab: number;
  stardust: number;
  planet: number;
  quantum: number;
  gems: number;
  achievements: number;
  empire: number;
  upgradesAll: number;
  total: number;
}

export function permanentMults(s: GameState): MultBreakdown {
  const labM = Math.pow(2, lab(s, 'income'));
  const stardust = 1 + STARDUST_BONUS * s.stardustEarned;
  const planet = Math.pow(PLANET_MULT, s.planet);
  const quantum = Math.pow(3, qlvl(s, 'qincome')) * (1 + QUANTUM_PASSIVE * s.quantumEarned);
  const gems = Math.pow(2, s.gemPerm);
  const achievements = 1 + ACHIEVEMENT_BONUS * achievementCount(s);
  const empire = Math.pow(empireMultPer(s), empireCount(s));
  let upgradesAll = 1;
  for (const u of UPGRADES) if (u.target === -1 && s.upgrades[u.id]) upgradesAll *= u.mult;
  const total = labM * stardust * planet * quantum * gems * achievements * empire * upgradesAll;
  return { lab: labM, stardust, planet, quantum, gems, achievements, empire, upgradesAll, total };
}

export interface Calc {
  /** Ertrag pro Zyklus je Anlage (inkl. aller Multiplikatoren + Boosts) */
  rev: number[];
  /** Zykluszeit je Anlage in Sekunden */
  time: number[];
  /** Einkommen/s aller Anlagen mit Manager (inkl. Boosts) */
  income: number;
  /** wie income, aber ohne temporäre Boosts (Offline, Zeitsprung) */
  baseIncome: number;
  /** Einkommen/s aller besessenen Anlagen, als würden alle laufen */
  potential: number;
  incomeBoost: number;
  speedBoost: number;
  perm: MultBreakdown;
}

export function newCalc(): Calc {
  return {
    rev: Array(BUILDING_COUNT).fill(0),
    time: Array(BUILDING_COUNT).fill(1),
    income: 0,
    baseIncome: 0,
    potential: 0,
    incomeBoost: 1,
    speedBoost: 1,
    perm: permanentMultsEmpty(),
  };
}

function permanentMultsEmpty(): MultBreakdown {
  return { lab: 1, stardust: 1, planet: 1, quantum: 1, gems: 1, achievements: 1, empire: 1, upgradesAll: 1, total: 1 };
}

const perBuildingUpg = new Array<number>(BUILDING_COUNT).fill(1);

/** Berechnet alle abgeleiteten Werte in `out` (wiederverwendbar, keine Allokation pro Frame) */
export function compute(s: GameState, now: number, out: Calc): Calc {
  let incomeBoost = 1;
  let speedBoost = 1;
  for (const b of s.boosts) {
    if (b.until <= now) continue;
    if (b.kind === 'income') incomeBoost *= b.mult;
    else speedBoost *= b.mult;
  }
  perBuildingUpg.fill(1);
  for (const u of UPGRADES) if (u.target >= 0 && s.upgrades[u.id]) perBuildingUpg[u.target] *= u.mult;

  const perm = permanentMults(s);
  const warp = 1 + 0.25 * lab(s, 'warp');
  let income = 0;
  let potential = 0;
  for (let i = 0; i < BUILDING_COUNT; i++) {
    const d = BUILDINGS[i];
    const owned = s.buildings[i].owned;
    const speed = warp * Math.pow(2, milestoneCount(owned));
    const baseRev = d.baseRevenue * owned * perBuildingUpg[i] * perm.total;
    const t = d.baseTime / speed;
    out.time[i] = t / speedBoost;
    out.rev[i] = baseRev * incomeBoost;
    if (owned > 0) {
      const ps = baseRev / t;
      potential += ps;
      if (s.managers[i]) income += ps;
    }
  }
  out.baseIncome = income;
  out.income = income * incomeBoost * speedBoost;
  out.potential = potential * incomeBoost * speedBoost;
  out.incomeBoost = incomeBoost;
  out.speedBoost = speedBoost;
  out.perm = perm;
  return out;
}
