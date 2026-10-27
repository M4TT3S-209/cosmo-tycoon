// Offline-Simulation: Einkommen in mitwachsenden Zeitschritten gutschreiben. Dazwischen arbeiten
// Auto-Käufer, Auto-Upgrader, Prüfungen und Auto-Supernova genau wie im laufenden Spiel.
import { muteEvents, emit } from './bus';
import { compute, ctier, newCalc, offlineCapSec, offlineEfficiency, pendingStardust } from './economy';
import { autoLab, autoLabActive, earn } from './actions';
import { autoOptions, autoSpend } from './autobuy';
import { checkChallenge } from './challenges';
import { RES_IDS, simulateColonies, type ColonyBuilt, type MegaDone } from './colonies';
import { offlineEvents } from './events';
import { autoSupernovaReady, supernova } from './prestige';
import type { GameState, Resources } from './state';

/** Schrittweite: 8 % der bisherigen Laufzeit, mindestens 2 s, höchstens 10 min */
const STEP_FRACTION = 0.08;
const MIN_STEP = 2;
const MAX_STEP = 600;
const MAX_STEPS = 6000;
/** Rechenzeit-Bremse: danach in großen Schritten zu Ende rechnen */
const TIME_BUDGET_MS = 500;
const scratch = newCalc();

export interface OfflineSummary {
  seconds: number;
  counted: number;
  capped: boolean;
  /** Geld insgesamt, über alle Läufe */
  earned: number;
  /** Geld seit der letzten Supernova (das verdoppelt der Dialog) */
  runEarned: number;
  bought: number;
  upgrades: number;
  managers: number;
  supernovas: number;
  stardust: number;
  planetBefore: number;
  planetAfter: number;
  /** Sternenstaub, den eine Supernova bringen würde: vorher → nachher */
  pendingBefore: number;
  pendingAfter: number;
  rankBefore: number;
  rankAfter: number;
  /** bestandene Prüfungen: [id, Stufe] */
  challenges: [string, number][];
  /** abgelaufene Prüfungen (Countdown) */
  failed: string[];
  /** eingetroffene Funksprüche */
  events: number;
  /** Rohstoffe aus den Kolonien */
  res: Resources;
  /** fertig gewordene Kolonie-Bauten und Megaprojekt-Stufen */
  built: ColonyBuilt[];
  mega: MegaDone[];
  /** im Auto-Labor gekaufte Forschung */
  labBuys: number;
}

export interface OfflineOptions {
  /** Anteil des Einkommens (Offline-Effizienz) – 1 beim Zeitsprung */
  efficiency?: number;
  /** ob der Offline-Speicher die Dauer begrenzt */
  cap?: boolean;
  /** Auto-Supernova erlaubt (aus beim Zeitsprung) */
  supernova?: boolean;
  /** zählt als Laufzeit (aus beim Zeitsprung, wegen der Countdown-Prüfung) */
  runTime?: boolean;
}

const perfNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Simuliert `seconds` Abwesenheit. */
export function simulateOffline(s: GameState, seconds: number, now: number, opt: OfflineOptions = {}): OfflineSummary {
  const efficiency = opt.efficiency ?? offlineEfficiency(s);
  const cap = opt.cap ?? true;
  const allowNova = opt.supernova ?? true;
  const countRun = opt.runTime ?? true;
  const counted = Math.max(0, cap ? Math.min(seconds, offlineCapSec(s)) : seconds);
  const before = { bought: s.stats.buildingsBought, upgrades: s.stats.upgradesBought, managers: s.stats.managersHired };
  const sum: OfflineSummary = {
    seconds, counted, capped: cap && seconds > counted, earned: 0, runEarned: 0, bought: 0, upgrades: 0, managers: 0,
    supernovas: 0, stardust: 0, planetBefore: s.planet, planetAfter: s.planet, pendingBefore: pendingStardust(s), pendingAfter: 0,
    rankBefore: s.rank.level, rankAfter: s.rank.level, challenges: [], failed: [], events: 0,
    res: { metal: 0, crystal: 0, deut: 0, alloy: 0, chips: 0 }, built: [], mega: [], labBuys: 0,
  };
  const labAuto = autoLabActive(s);
  const auto = autoOptions(s);
  const start = perfNow();
  let clock = s.runTime;
  let t = 0;
  let hurry = false;
  muteEvents(true);
  try {
    for (let step = 0; t < counted && step < MAX_STEPS; step++) {
      if (!hurry && (step & 31) === 31 && perfNow() - start > TIME_BUDGET_MS) hurry = true;
      let dt = Math.min(MAX_STEP, Math.max(MIN_STEP, clock * STEP_FRACTION));
      if (hurry) dt = Math.max(dt, (counted - t) / 16);
      dt = Math.min(dt, counted - t);
      compute(s, now, scratch);
      const amount = scratch.baseIncome * efficiency * dt;
      earn(s, amount);
      sum.earned += amount;
      sum.runEarned += amount;
      t += dt;
      clock += dt;
      if (countRun) s.runTime += dt;
      if (auto) autoSpend(s, now, { ...auto, efficiency, maxSteps: 60 });
      const chal = s.challenge.active;
      if (chal) {
        const tier = ctier(s, chal);
        checkChallenge(s);
        if (ctier(s, chal) > tier) sum.challenges.push([chal, ctier(s, chal)]);
        else if (!s.challenge.active) sum.failed.push(chal);
      }
      if (allowNova && !s.challenge.active && autoSupernovaReady(s)) {
        const gain = pendingStardust(s);
        if (supernova(s)) {
          sum.supernovas++;
          sum.stardust += gain;
          sum.runEarned = 0;
          clock = 0;
          if (labAuto) sum.labBuys += autoLab(s);
        }
      }
    }
  } finally {
    muteEvents(false);
  }
  if (labAuto) sum.labBuys += autoLab(s);
  if (countRun) {
    sum.events = offlineEvents(s, counted, now);
    // Kolonien arbeiten nach Wanduhr: die ganze Abwesenheit zählt, begrenzt nur vom Lager
    const col = simulateColonies(s, seconds, now);
    for (const k of RES_IDS) sum.res[k] = Math.max(0, s.res[k] - col.before[k]);
    sum.built = col.built;
    sum.mega = col.mega;
  }
  sum.bought = s.stats.buildingsBought - before.bought;
  sum.upgrades = s.stats.upgradesBought - before.upgrades;
  sum.managers = s.stats.managersHired - before.managers;
  sum.planetAfter = s.planet;
  sum.pendingAfter = pendingStardust(s);
  sum.rankAfter = s.rank.level;
  emit('structure', {});
  return sum;
}

/** Zeitsprung (Shop, tägliche Belohnung): volle Effizienz, kein Deckel. Gibt das verdiente Geld zurück. */
export function timeWarp(s: GameState, hours: number, now: number, silent = false): number {
  const c = compute(s, now, scratch);
  let amount: number;
  if (c.baseIncome > 0) {
    // ohne Supernova („Einkommen“) und ohne Laufzeit (Countdown-Prüfung)
    amount = simulateOffline(s, hours * 3600, now, { efficiency: 1, cap: false, supernova: false, runTime: false }).earned;
  } else {
    // ohne Manager zählt wenigstens das halbe Potenzial, damit es sich nie leer anfühlt
    const rate = (c.potential / Math.max(1, c.incomeBoost * c.speedBoost)) * 0.5;
    amount = rate * hours * 3600;
    earn(s, amount);
  }
  s.stats.timeWarps++;
  if (!silent) emit('timewarp', { amount, hours });
  return amount;
}
