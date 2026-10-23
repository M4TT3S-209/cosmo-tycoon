// Offline-Simulation: Einkommen in Schritten gutschreiben, dazwischen kaufen Auto-Käufer/-Upgrader
import { muteEvents, emit } from './bus';
import { compute, lab, newCalc, offlineCapSec, offlineEfficiency } from './economy';
import { earn } from './actions';
import { autoBuy, autoUpgrade } from './tick';
import type { GameState } from './state';

const MAX_STEPS = 240;
const STEP_SECONDS = 30;
const scratch = newCalc();

export interface OfflineSummary {
  seconds: number;
  counted: number;
  capped: boolean;
  earned: number;
  bought: number;
  upgrades: number;
  managers: number;
}

/**
 * Simuliert `seconds` Abwesenheit.
 * @param efficiency Anteil des Einkommens (Offline-Effizienz) – 1 beim Zeitsprung
 * @param cap ob der Offline-Speicher die Dauer begrenzt
 */
export function simulateOffline(s: GameState, seconds: number, now: number, efficiency = offlineEfficiency(s), cap = true): OfflineSummary {
  const counted = Math.max(0, cap ? Math.min(seconds, offlineCapSec(s)) : seconds);
  const before = { bought: s.stats.buildingsBought, upgrades: s.stats.upgradesBought, managers: s.stats.managersHired };
  const steps = Math.max(1, Math.min(MAX_STEPS, Math.ceil(counted / STEP_SECONDS)));
  const dt = counted / steps;
  const doUpgrade = lab(s, 'autoupgrade') > 0 && s.settings.autoUpgrade;
  const doBuy = lab(s, 'autobuy') > 0 && s.settings.autoBuy;
  let earned = 0;
  muteEvents(true);
  try {
    for (let k = 0; k < steps && counted > 0; k++) {
      compute(s, now, scratch);
      const amount = scratch.baseIncome * efficiency * dt;
      earn(s, amount);
      earned += amount;
      s.runTime += dt;
      if (doUpgrade) autoUpgrade(s);
      if (doBuy) autoBuy(s);
    }
  } finally {
    muteEvents(false);
  }
  emit('structure', {});
  return {
    seconds,
    counted,
    capped: cap && seconds > counted,
    earned,
    bought: s.stats.buildingsBought - before.bought,
    upgrades: s.stats.upgradesBought - before.upgrades,
    managers: s.stats.managersHired - before.managers,
  };
}

/** Zeitsprung (Shop, tägliche Belohnung): volle Effizienz, kein Deckel. Gibt das verdiente Geld zurück. */
export function timeWarp(s: GameState, hours: number, now: number): number {
  const c = compute(s, now, scratch);
  let amount: number;
  if (c.baseIncome > 0) {
    amount = simulateOffline(s, hours * 3600, now, 1, false).earned;
    s.runTime -= hours * 3600; // Zeitsprung zählt nicht als Laufzeit (Countdown-Prüfung)
  } else {
    // ohne Manager zählt wenigstens das halbe Potenzial, damit es sich nie leer anfühlt
    const rate = (c.potential / Math.max(1, c.incomeBoost * c.speedBoost)) * 0.5;
    amount = rate * hours * 3600;
    earn(s, amount);
  }
  s.stats.timeWarps++;
  emit('timewarp', { amount, hours });
  return amount;
}
