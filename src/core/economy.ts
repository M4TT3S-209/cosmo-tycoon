// Reine Formeln: Kosten, Multiplikatoren, Einkommen. Kein DOM.
import { BUILDINGS, MILESTONES, EMPIRE_MILESTONES, BUILDING_COUNT } from '../data/buildings';
import { MANAGERS } from '../data/managers';
import { UPGRADES } from '../data/upgrades';
import { PLANETS, PLANET_MULT } from '../data/planets';
import { START_CASH } from '../data/lab';
import { ARTIFACT_INDEX } from '../data/artifacts';
import { prosperityMult } from './colonies';
import { cap } from './safe';
import { megaStage, talentBonus } from './talentfx';
import type { LabNode } from '../data/lab';
import type { UpgradeDef } from '../data/upgrades';
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

export const QUANTUM_K = 7; // Quantenkerne genau am Galaxiekern
export const STARDUST_BONUS = 0.02; // +2 % pro verdientem ✨
export const ACHIEVEMENT_BONUS = 0.01; // +1 % pro Erfolg
export const QUANTUM_PASSIVE = 0.25; // +25 % pro verdientem ⚛️

export const RANK_BONUS = 0.01; // +1 % pro Kommandanten-Level

export const lab = (s: GameState, id: string): number => s.lab[id] ?? 0;
export const qlvl = (s: GameState, id: string): number => s.qperks[id] ?? 0;

// ---- Prüfungen ---------------------------------------------------------------
/** Läuft gerade die Prüfung `id`? */
export const chalActive = (s: GameState, id: string): boolean => s.challenge.active === id;
/** Abgeschlossene Stufen einer Prüfung */
export const ctier = (s: GameState, id: string): number => s.challengeTiers[id] ?? 0;

/** Arbeitet der Manager dieser Anlage gerade? (in „Ohne Manager“ nicht) */
export function isManaged(s: GameState, i: number): boolean {
  return s.managers[i] && !chalActive(s, 'nomgr');
}

/** In „Nur 5 Anlagen“ sind die Anlagen 6–10 gesperrt */
export function buildingBlocked(s: GameState, i: number): boolean {
  return i >= 5 && chalActive(s, 'five');
}

export function rankMult(s: GameState): number {
  return 1 + RANK_BONUS * (s.rank.level - 1);
}

export function planetTrait(s: GameState) {
  return PLANETS[s.planet]?.trait;
}

// ---- Artefakte (nur ausgerüstete wirken) --------------------------------------
export interface ArtBonus {
  income: number;
  bld: number[];
  offline: number;
  offcap: number;
  comet: number;
  cometLuck: number;
  gems: number;
  dust: number;
  discount: number;
  speed: number;
  expSpeed: number;
  expLoot: number;
  expSuccess: number;
  em: number;
}

const artScratch: ArtBonus = {
  income: 0, bld: Array(BUILDING_COUNT).fill(0), offline: 0, offcap: 0, comet: 0, cometLuck: 0,
  gems: 0, dust: 0, discount: 0, speed: 0, expSpeed: 0, expLoot: 0, expSuccess: 0, em: 0,
};

/** Summe der Artefakt-Boni (Anteile, z. B. 0,3 = +30 %). Wiederverwendetes Objekt – sofort auslesen. */
export function artifactBonus(s: GameState): ArtBonus {
  const b = artScratch;
  b.income = b.offline = b.offcap = b.comet = b.cometLuck = b.gems = b.dust = 0;
  b.discount = b.speed = b.expSpeed = b.expLoot = b.expSuccess = b.em = 0;
  b.bld.fill(0);
  const power = talentBonus(s).artPower;
  for (const id of s.equipped) {
    const def = ARTIFACT_INDEX[id];
    const lvl = s.artifacts[id]?.level ?? 0;
    if (!def || lvl <= 0) continue;
    const v = def.v * lvl * power;
    if (def.kind === 'bld') b.bld[def.b ?? 0] += v;
    else b[def.kind] += v;
  }
  return b;
}

export function milestoneCount(owned: number): number {
  let c = 0;
  for (const m of MILESTONES) if (owned >= m) c++;
  return c;
}

/** Ertrag/s einer Anlage mit `owned` Stück, aus dem Stück-Ertrag `unit` (siehe Calc.unit) */
export function rateAt(unit: number, owned: number, base = 2): number {
  return owned > 0 ? cap(unit * owned * Math.pow(base, milestoneCount(owned))) : 0;
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
  return 2 + lab(s, 'milestone') * 0.25 + talentBonus(s).empirePlus;
}

export function costDiscount(s: GameState): number {
  const art = Math.min(0.15, artifactBonus(s).discount);
  const chal = Math.max(0.5, 1 - 0.03 * ctier(s, 'inflation'));
  return Math.pow(0.95, lab(s, 'discount')) * (1 - art) * chal * talentBonus(s).cost * (chalActive(s, 'inflation') ? 10 : 1);
}

/** Preis eines Upgrades (Talent „Monopol“ halbiert) */
export function upgradeCost(s: GameState, u: UpgradeDef): number {
  return u.cost * talentBonus(s).upgradeCost;
}

/** Preis der nächsten Labor-Stufe in ✨ (Talent „Laborassistenz“ senkt ihn) */
export function labCost(s: GameState, node: LabNode, lvl: number): number {
  return Math.ceil(node.cost(lvl) * talentBonus(s).labCost);
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
  cash = cap(cash); // bei „unendlich“ würde die Korrektur-Schleife unten nie enden
  const first = d.baseCost * Math.pow(r, s.buildings[i].owned) * costDiscount(s);
  if (!(cash >= first)) return 0;
  const n = Math.floor(Math.log((cash * (r - 1)) / first + 1) / Math.log(r));
  // Gleitkomma-Korrektur
  let m = Number.isFinite(n) ? Math.max(0, n) : 0;
  while (m > 0 && buildingCost(s, i, m) > cash) m--;
  for (let k = 0; k < 100 && buildingCost(s, i, m + 1) <= cash; k++) m++;
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

/** Jede neue Galaxie ist größer: Planeten brauchen dort mehr Sternenstaub */
export const GALAXY_NEED_SCALE = 25;

export function planetNeed(s: GameState, i: number): number {
  return PLANETS[i].need * Math.pow(GALAXY_NEED_SCALE, s.galaxyJumps);
}

export function planetFor(s: GameState): number {
  let p = 0;
  for (let i = 0; i < PLANETS.length; i++) if (s.stardustEarned >= planetNeed(s, i)) p = i;
  // Sternentor Stufe 5: Start einen Planeten weiter
  const start = qlvl(s, 'qstart') + (megaStage(s, 'tor') >= 5 ? 1 : 0);
  return Math.max(p, Math.min(PLANETS.length - 1, start));
}

export function achievementCount(s: GameState): number {
  let c = 0;
  for (const k in s.achievements) if (s.achievements[k]) c++;
  return c;
}

export function gemMult(s: GameState): number {
  return (1 + 0.25 * lab(s, 'gemfinder')) * (1 + 0.5 * qlvl(s, 'qgems')) * (1 + artifactBonus(s).gems) * talentBonus(s).gems;
}

export function boostDurationMult(s: GameState): number {
  return 1 + 0.25 * lab(s, 'boostlen');
}

export function offlineCapSec(s: GameState): number {
  const extra = artifactBonus(s).offcap + 2 * Math.max(0, ctier(s, 'countdown') - 1);
  return (2 + 2 * lab(s, 'offtime') + extra + talentBonus(s).offlineHours) * 3600;
}

export function offlineEfficiency(s: GameState): number {
  const base = Math.min(1, 0.5 + 0.1 * lab(s, 'offeff'));
  const limit = 1.5 + 0.1 * megaStage(s, 'chrono');
  return Math.min(limit, base + artifactBonus(s).offline + (planetTrait(s)?.offline ?? 0) + talentBonus(s).offlineEff);
}

export function startCash(s: GameState): number {
  return Math.max(4, START_CASH(lab(s, 'startcash')) * talentBonus(s).startCash);
}

export function dustMult(s: GameState): number {
  const art = 1 + artifactBonus(s).dust;
  return (1 + 0.15 * lab(s, 'snboost')) * Math.pow(1.5, qlvl(s, 'qdust')) * art * (1 + 0.05 * ctier(s, 'dark')) * talentBonus(s).dust;
}

/** Sternenstaub, den eine Supernova jetzt bringen würde */
export function pendingStardust(s: GameState): number {
  return Math.floor(stardustExact(s));
}

/** ungerundeter Wert (für Fortschrittsanzeige) */
export function stardustExact(s: GameState): number {
  if (!(s.runEarnings >= 1)) return 0;
  return cap(Math.pow(10, dustCurve(Math.log10(s.runEarnings))) * dustMult(s));
}

/** Lauf-Einnahmen, die für `p` ✨ nötig sind */
export function earningsForDust(s: GameState, p: number): number {
  if (p <= 0) return 0;
  return cap(Math.pow(10, dustCurveInverse(Math.log10(p / dustMult(s)))));
}

/** Lauf-Einnahmen, die für den nächsten ✨ nötig sind */
export function earningsForNextDust(s: GameState): number {
  return earningsForDust(s, pendingStardust(s) + 1);
}

/**
 * Quantenkerne: am Galaxiekern ~QUANTUM_K Kerne, mehr, je weiter du darüber hinaus gehst.
 * Relativ zum Bedarf der aktuellen Galaxie, damit die Kerne pro Sprung nicht explodieren.
 */
export function pendingQuantum(s: GameState): number {
  return Math.floor(cap(QUANTUM_K * Math.sqrt(s.stardustEarned / planetNeed(s, PLANETS.length - 1)) * talentBonus(s).quantum));
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
  rank: number;
  artifacts: number;
  challenges: number;
  talents: number;
  /** Wohlstand der Kolonien × Dyson-Schwarm */
  colonies: number;
  total: number;
}

export function permanentMults(s: GameState): MultBreakdown {
  const labM = Math.pow(2, lab(s, 'income'));
  const stardust = chalActive(s, 'dark') ? 1 : 1 + STARDUST_BONUS * s.stardustEarned;
  const planet = Math.pow(PLANET_MULT, s.planet);
  const quantum = Math.pow(3, qlvl(s, 'qincome')) * (1 + QUANTUM_PASSIVE * s.quantumEarned);
  const gems = Math.pow(2, s.gemPerm);
  const achievements = 1 + ACHIEVEMENT_BONUS * achievementCount(s);
  const empire = Math.pow(empireMultPer(s), empireCount(s));
  const protocolBoost = 1 + 0.02 * ctier(s, 'noupg');
  let upgradesAll = 1;
  for (const u of UPGRADES) if (u.target === -1 && s.upgrades[u.id]) upgradesAll *= u.mult * protocolBoost;
  const rank = rankMult(s);
  const artifacts = 1 + artifactBonus(s).income;
  const challenges = (1 + 0.25 * ctier(s, 'nomgr')) * (chalActive(s, 'storm') ? 0.1 : 1);
  const talents = talentBonus(s).income;
  const colonies = prosperityMult(s) * Math.pow(2, megaStage(s, 'dyson'));
  const total = cap(labM * stardust * planet * quantum * gems * achievements * empire * upgradesAll * rank * artifacts * challenges * talents * colonies);
  return { lab: labM, stardust, planet, quantum, gems, achievements, empire, upgradesAll, rank, artifacts, challenges, talents, colonies, total };
}

export interface Calc {
  /** Ertrag pro Zyklus je Anlage (inkl. aller Multiplikatoren + Boosts) */
  rev: number[];
  /** Zykluszeit je Anlage in Sekunden */
  time: number[];
  /** Ertrag/s pro Stück ohne Meilensteine und temporäre Boosts (gesperrt: 0) */
  unit: number[];
  /** Tempo-Faktor pro Meilenstein (2, mit Talent „Präzision“ 2,2) */
  msBase: number;
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
    unit: Array(BUILDING_COUNT).fill(0),
    msBase: 2,
    income: 0,
    baseIncome: 0,
    potential: 0,
    incomeBoost: 1,
    speedBoost: 1,
    perm: permanentMultsEmpty(),
  };
}

function permanentMultsEmpty(): MultBreakdown {
  return { lab: 1, stardust: 1, planet: 1, quantum: 1, gems: 1, achievements: 1, empire: 1, upgradesAll: 1, rank: 1, artifacts: 1, challenges: 1, talents: 1, colonies: 1, total: 1 };
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
  const art = artifactBonus(s);
  const trait = planetTrait(s);
  const tb = talentBonus(s);
  const msBase = tb.milestoneBase;
  const slow = chalActive(s, 'slow') ? 10 : 1;
  const warp = ((1 + 0.25 * lab(s, 'warp')) * (1 + art.speed) * (1 + 0.2 * ctier(s, 'slow')) * tb.speed) / slow;
  const highTier = Math.pow(1.5, ctier(s, 'five')) * tb.bigBuildings;
  let income = 0;
  let potential = 0;
  for (let i = 0; i < BUILDING_COUNT; i++) {
    const d = BUILDINGS[i];
    const blocked = buildingBlocked(s, i);
    const owned = blocked ? 0 : s.buildings[i].owned;
    const speed = warp * Math.pow(msBase, milestoneCount(owned));
    const bldMult = (trait?.bld?.[i] ?? 1) * (1 + art.bld[i]) * (i >= 5 ? highTier : 1);
    const baseRev = d.baseRevenue * owned * perBuildingUpg[i] * bldMult * perm.total;
    const t = d.baseTime / speed;
    out.unit[i] = blocked ? 0 : cap((d.baseRevenue * perBuildingUpg[i] * bldMult * perm.total * warp) / d.baseTime);
    out.time[i] = t / speedBoost;
    out.rev[i] = cap(baseRev * incomeBoost);
    if (owned > 0) {
      const ps = baseRev / t;
      potential += ps;
      if (isManaged(s, i)) income += ps;
    }
  }
  out.baseIncome = cap(income);
  out.income = cap(income * incomeBoost * speedBoost);
  out.potential = cap(potential * incomeBoost * speedBoost);
  out.incomeBoost = incomeBoost;
  out.speedBoost = speedBoost;
  out.perm = perm;
  out.msBase = msBase;
  return out;
}
