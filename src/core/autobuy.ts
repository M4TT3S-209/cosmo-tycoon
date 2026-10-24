// Schlauer Auto-Käufer: entscheidet nach Amortisationszeit (Kosten ÷ Einkommens-Zuwachs, bei noch
// nicht bezahlbaren Zielen plus Wartezeit). Achtet auf Meilensteine (Tempo ×2), Imperium-Meilensteine
// (×2/×3 auf alles), Upgrades und Manager und spart für starke Ziele, die bald bezahlbar sind.
// Läuft online (slowTick) und offline (simulateOffline).
import { BUILDINGS, BUILDING_COUNT } from '../data/buildings';
import { MANAGERS } from '../data/managers';
import { UPGRADES, type UpgradeDef } from '../data/upgrades';
import { buyBuildingCount, buyUpgrade, hireManager } from './actions';
import {
  buildingBlocked, buildingCost, chalActive, compute, ctier, empireMultPer, isManaged, lab, maxAffordable,
  milestoneCount, newCalc, nextEmpireMilestone, nextMilestone, rateAt,
} from './economy';
import { cap } from './safe';
import type { GameState } from './state';

/** Länger als so viele Sekunden wird nicht auf ein Upgrade oder einen Manager gespart */
const MAX_WAIT = 3600;
/** Upgrades unter diesem Anteil des Geldes werden sofort gekauft */
const SMALL_UPGRADE = 0.01;
/** so viele der nächsten Upgrades werden bewertet */
const UPGRADE_LOOKAHEAD = 12;
const SEARCH_STEPS = 32;

export interface AutoOptions {
  /** Anlagen kaufen (Auto-Käufer) */
  buildings: boolean;
  /** Upgrades und Manager kaufen (Auto-Upgrader) */
  upgrades: boolean;
  /** Offline: Anteil des Einkommens für die Wartezeit (sonst zählen laufende Boosts) */
  efficiency?: number;
  /** höchstens so viele Kauf-Schritte pro Aufruf */
  maxSteps?: number;
}

/** Welche Automatik ist freigeschaltet und eingeschaltet? null = keine */
export function autoOptions(s: GameState): AutoOptions | null {
  const buildings = lab(s, 'autobuy') > 0 && s.settings.autoBuy;
  const upgrades = lab(s, 'autoupgrade') > 0 && s.settings.autoUpgrade;
  return buildings || upgrades ? { buildings, upgrades } : null;
}

export interface AutoTarget {
  /** true = wartet und kauft nichts anderes, false = kauft schrittweise darauf hin */
  saving: boolean;
  label: string;
  cost: number;
  /** geschätzte Sekunden, bis es bezahlbar ist */
  eta: number;
}

/** Worauf arbeitet der Auto-Käufer gerade hin? (nur für die Anzeige, nicht im Spielstand) */
export const autoStatus: { target: AutoTarget | null } = { target: null };

type LumpKind = 'ms' | 'empire' | 'upgrade' | 'manager';
interface Lump {
  kind: LumpKind;
  /** Anlage (Meilenstein, Manager) */
  i: number;
  /** Ziel-Bestand (Meilenstein bzw. Imperium-Stufe) */
  to: number;
  upg: UpgradeDef | null;
  cost: number;
  pp: number;
}

// ---- Modell des aktuellen Zustands (wiederverwendet, keine Allokation pro Aufruf) ----
const calc = newCalc();
const owned = new Array<number>(BUILDING_COUNT).fill(0);
const rate = new Array<number>(BUILDING_COUNT).fill(0);
let potential = 0;
let income = 0;

// Einzelstufen im aktuellen Abschnitt (bis vor den nächsten Meilenstein), in log-Form
const segRoom = new Array<number>(BUILDING_COUNT).fill(0);
const segLogC0 = new Array<number>(BUILDING_COUNT).fill(0);
const segLogD = new Array<number>(BUILDING_COUNT).fill(0);
const logR = BUILDINGS.map((b) => Math.log(b.costMult));
const affordable = new Array<number>(BUILDING_COUNT).fill(0);
const take = new Array<number>(BUILDING_COUNT).fill(0);

function refresh(s: GameState, now: number, o: AutoOptions): void {
  compute(s, now, calc);
  potential = 0;
  let managed = 0;
  for (let i = 0; i < BUILDING_COUNT; i++) {
    const own = buildingBlocked(s, i) ? 0 : s.buildings[i].owned;
    owned[i] = own;
    rate[i] = rateAt(calc.unit[i], own);
    potential += rate[i];
    if (isManaged(s, i)) managed += rate[i];
  }
  potential = cap(potential);
  income = cap(managed * (o.efficiency ?? calc.incomeBoost * calc.speedBoost));
}

/** Darf der Käufer diese Anlage kaufen? (freigeschaltet oder die nächste gesperrte) */
function buyable(s: GameState, i: number): boolean {
  if (!(calc.unit[i] > 0) || buildingBlocked(s, i)) return false;
  return s.buildings[i].owned > 0 || i === 0 || s.buildings[i - 1].owned > 0;
}

/** Amortisationszeit in Sekunden, inkl. Wartezeit bis das Geld reicht */
function payback(cost: number, gain: number, cash: number): number {
  if (!(gain > 0)) return Infinity;
  const wait = cost <= cash ? 0 : income > 0 ? (cost - cash) / income : Infinity;
  return wait + cost / gain;
}

/** beste noch nicht bezahlbare Einzelstufe (Amortisation inkl. Wartezeit) */
let waitBest = Infinity;
let waitIdx = -1;
let waitCost = 0;

/** Bereitet die Einzelstufen vor; gibt die beste Amortisation einer bezahlbaren Einzelstufe zurück */
function prepareSingles(s: GameState): number {
  let best = Infinity;
  waitBest = Infinity;
  waitIdx = -1;
  for (let i = 0; i < BUILDING_COUNT; i++) {
    segRoom[i] = 0;
    if (!buyable(s, i)) continue;
    const own = owned[i];
    const next = nextMilestone(own);
    const room = next === null ? Infinity : next - 1 - own;
    if (room < 1) continue;
    const c0 = buildingCost(s, i, 1);
    const d = cap(calc.unit[i] * Math.pow(2, milestoneCount(own)));
    segRoom[i] = room;
    segLogC0[i] = Math.log(c0);
    segLogD[i] = Math.log(d);
    if (c0 <= s.cash) best = Math.min(best, c0 / d);
    else {
      const pp = payback(c0, d, s.cash);
      if (pp < waitBest) {
        waitBest = pp;
        waitIdx = i;
        waitCost = c0;
      }
    }
  }
  return best;
}

/** Wie viele der nächsten Stufen amortisieren sich höchstens in e^logTheta Sekunden? */
function levelsBelow(i: number, logTheta: number): number {
  const room = segRoom[i];
  if (room < 1) return 0;
  if (logTheta === Infinity) return room;
  const lx = logTheta + segLogD[i] - segLogC0[i];
  if (lx < -1e-9) return 0;
  return Math.min(room, Math.floor(Math.max(0, lx) / logR[i] + 1e-9) + 1);
}

function plan(s: GameState, logTheta: number): number {
  let total = 0;
  for (let i = 0; i < BUILDING_COUNT; i++) {
    const k = Math.min(levelsBelow(i, logTheta), affordable[i]);
    take[i] = k;
    if (k > 0) total += buildingCost(s, i, k);
  }
  return total;
}

/**
 * Kauft in einem Rutsch alle Einzelstufen, die sich schneller amortisieren als `theta`.
 * Reicht das Geld nicht für alle, wird die Schwelle per Halbierungssuche ans Budget angepasst.
 */
function bulkSingles(s: GameState, theta: number, best: number): number {
  let hi = theta === Infinity ? -Infinity : Math.log(theta);
  for (let i = 0; i < BUILDING_COUNT; i++) {
    affordable[i] = segRoom[i] >= 1 ? Math.min(segRoom[i], maxAffordable(s, i, s.cash)) : 0;
    if (theta === Infinity && affordable[i] > 0) hi = Math.max(hi, segLogC0[i] - segLogD[i] + (affordable[i] - 1) * logR[i]);
  }
  if (plan(s, hi) > s.cash) {
    let lo = Math.log(best);
    for (let k = 0; k < SEARCH_STEPS; k++) {
      const mid = (lo + hi) / 2;
      if (plan(s, mid) <= s.cash) lo = mid;
      else hi = mid;
    }
    plan(s, lo);
  }
  let bought = 0;
  for (let i = 0; i < BUILDING_COUNT; i++) if (take[i] > 0 && buyBuildingCount(s, i, take[i])) bought += take[i];
  return bought;
}

/** Das beste „größere“ Ziel: Meilenstein, Imperium-Paket, Upgrade oder Manager */
function bestLump(s: GameState, o: AutoOptions): Lump | null {
  let best: Lump | null = null;
  const cash = s.cash;
  const consider = (kind: LumpKind, i: number, to: number, upg: UpgradeDef | null, cost: number, gain: number) => {
    if (!(gain > 0) || !(cost > 0)) return;
    // auf Upgrades und Manager wird nur gespart, wenn sie bald bezahlbar sind
    if ((kind === 'upgrade' || kind === 'manager') && cost > cash && !(income > 0 && (cost - cash) / income <= MAX_WAIT)) return;
    const pp = payback(cost, gain, cash);
    if (pp < Infinity && (!best || pp < best.pp)) best = { kind, i, to, upg, cost, pp };
  };

  if (o.buildings) {
    // Imperium: nur wenn alle Anlagen freigeschaltet und kaufbar sind
    const E = nextEmpireMilestone(s);
    const empMult = empireMultPer(s);
    let below = 0;
    let belowIdx = -1;
    let open = E !== null;
    if (E !== null) {
      for (let i = 0; i < BUILDING_COUNT; i++) {
        const own = s.buildings[i].owned;
        if (own === 0) open = false;
        if (own < E) {
          below++;
          belowIdx = i;
          if (buildingBlocked(s, i)) open = false;
        }
      }
    }
    for (let i = 0; i < BUILDING_COUNT; i++) {
      if (!buyable(s, i)) continue;
      const M = nextMilestone(owned[i]);
      if (M === null) continue;
      const after = rateAt(calc.unit[i], M);
      let gain = after - rate[i];
      // vollendet dieser Meilenstein-Kauf zugleich den Imperium-Meilenstein?
      if (open && below === 1 && belowIdx === i && M >= E!) gain = empMult * (potential - rate[i] + after) - potential;
      consider('ms', i, M, null, buildingCost(s, i, M - owned[i]), gain);
    }
    if (open) {
      let cost = 0;
      let after = 0;
      for (let i = 0; i < BUILDING_COUNT; i++) {
        const own = s.buildings[i].owned;
        if (own < E!) {
          cost += buildingCost(s, i, E! - own);
          after += rateAt(calc.unit[i], E!);
        } else after += rate[i];
      }
      consider('empire', -1, E!, null, cost, empMult * after - potential);
    }
  }

  if (o.upgrades && !chalActive(s, 'noupg')) {
    const proto = 1 + 0.02 * ctier(s, 'noupg');
    let n = 0;
    for (const u of UPGRADES) {
      if (s.upgrades[u.id]) continue;
      if (++n > UPGRADE_LOOKAHEAD) break;
      const gain = u.target >= 0 ? (u.mult - 1) * rate[u.target] : (u.mult * proto - 1) * potential;
      consider('upgrade', u.target, 0, u, u.cost, gain);
    }
  }
  if (o.upgrades && !chalActive(s, 'nomgr')) {
    for (let i = 0; i < BUILDING_COUNT; i++) {
      if (!s.managers[i] && s.buildings[i].owned > 0) consider('manager', i, 0, null, MANAGERS[i].cost, rate[i]);
    }
  }
  return best;
}

function buyLump(s: GameState, l: Lump): boolean {
  switch (l.kind) {
    case 'ms':
      return buyBuildingCount(s, l.i, l.to - s.buildings[l.i].owned);
    case 'empire': {
      let ok = false;
      for (let i = 0; i < BUILDING_COUNT; i++) {
        const own = s.buildings[i].owned;
        if (own < l.to && buyBuildingCount(s, i, l.to - own)) ok = true;
      }
      return ok;
    }
    case 'upgrade':
      return buyUpgrade(s, l.upg!.id);
    case 'manager':
      return hireManager(s, l.i);
  }
}

/** Meilenstein bzw. Imperium-Paket noch zu teuer: schon mal so viel davon kaufen wie möglich */
function partialLump(s: GameState, l: Lump): boolean {
  const parts: number[] = [];
  if (l.kind === 'ms') parts.push(l.i);
  else {
    for (let i = 0; i < BUILDING_COUNT; i++) if (s.buildings[i].owned < l.to) parts.push(i);
    // günstigste Teile zuerst
    parts.sort((a, b) => buildingCost(s, a, l.to - s.buildings[a].owned) - buildingCost(s, b, l.to - s.buildings[b].owned));
  }
  let ok = false;
  for (const i of parts) {
    const n = Math.min(l.to - s.buildings[i].owned, maxAffordable(s, i, s.cash));
    if (n >= 1 && buyBuildingCount(s, i, n)) ok = true;
  }
  return ok;
}

function lumpLabel(s: GameState, l: Lump): string {
  switch (l.kind) {
    case 'ms':
      return `${BUILDINGS[l.i].emoji} ${BUILDINGS[l.i].name} auf ${l.to} (Tempo ×2)`;
    case 'empire':
      return `🏆 alle Anlagen auf ${l.to} (Ertrag ×${String(empireMultPer(s)).replace('.', ',')})`;
    case 'upgrade':
      return `⬆️ ${l.upg!.name}`;
    case 'manager':
      return `👔 ${MANAGERS[l.i].name}`;
  }
}

/** Manager sofort; Upgrades sofort, wenn sie wenig kosten (alle, wenn nur der Auto-Upgrader läuft) */
function quickBuys(s: GameState, allUpgrades: boolean): number {
  let n = 0;
  if (!chalActive(s, 'nomgr')) {
    for (let i = 0; i < BUILDING_COUNT; i++) {
      if (!s.managers[i] && s.buildings[i].owned > 0 && MANAGERS[i].cost <= s.cash && hireManager(s, i)) n++;
    }
  }
  if (!chalActive(s, 'noupg')) {
    const limit = s.cash * SMALL_UPGRADE;
    for (const u of UPGRADES) {
      if (s.upgrades[u.id]) continue;
      if (u.cost > (allUpgrades ? s.cash : limit)) break;
      if (buyUpgrade(s, u.id)) n++;
    }
  }
  return n;
}

/** Ein Durchgang der Automatik. Gibt die Zahl der Kauf-Schritte zurück. */
export function autoSpend(s: GameState, now: number, o: AutoOptions): number {
  autoStatus.target = null;
  let actions = o.upgrades ? quickBuys(s, !o.buildings) : 0;
  if (!o.buildings) return actions;
  const maxSteps = o.maxSteps ?? 200;
  for (let step = 0; step < maxSteps; step++) {
    refresh(s, now, o);
    const single = prepareSingles(s);
    const lump = bestLump(s, o);
    const lumpPP = lump ? lump.pp : Infinity;
    // gekauft wird nur, was sich schneller lohnt als das beste Ziel – auch wenn das eine
    // noch nicht bezahlbare Einzelstufe ist (dann wird kurz darauf gespart)
    const limit = Math.min(lumpPP, waitBest);
    if (single < limit && bulkSingles(s, limit, single) > 0) {
      actions++;
      continue;
    }
    if (waitIdx >= 0 && waitBest < lumpPP) {
      const b = BUILDINGS[waitIdx];
      const eta = income > 0 ? (waitCost - s.cash) / income : Infinity;
      autoStatus.target = { saving: true, label: `${b.emoji} ${b.name} (Stufe ${owned[waitIdx] + 1})`, cost: waitCost, eta };
      break;
    }
    if (!lump) break;
    if (lump.cost <= s.cash) {
      if (!buyLump(s, lump)) break;
      actions++;
      continue;
    }
    const divisible = lump.kind === 'ms' || lump.kind === 'empire';
    const eta = income > 0 ? (lump.cost - s.cash) / income : Infinity;
    if (divisible && partialLump(s, lump)) actions++;
    autoStatus.target = { saving: !divisible, label: lumpLabel(s, lump), cost: lump.cost, eta };
    break;
  }
  return actions;
}
