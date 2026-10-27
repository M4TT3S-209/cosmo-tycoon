// Spieler-Aktionen: kaufen, einstellen, forschen, Shop, Kometen
import { BUILDINGS } from '../data/buildings';
import { UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import { LAB_INDEX, LAB_NODES, type LabNode } from '../data/lab';
import { QUANTUM_INDEX } from '../data/quantum';
import { emit, type CometKind } from './bus';
import {
  artifactBonus, buildingBlocked, buildingCost, buyAmount, chalActive, compute, ctier, empireCount, empireMultPer,
  gemMult, boostDurationMult, isManaged, lab, labCost, managerCost, milestoneCount, newCalc, planetTrait, upgradeCost, type Calc,
} from './economy';
import { megaStage, talentBonus } from './talentfx';
import type { Boost, BuyMode, GameState } from './state';
import { fmt } from './format';
import { XP, addXp } from './rank';
import { timeWarp } from './offline';
import { MAX_VALUE, cap, noteCap } from './safe';

export { timeWarp };

export function earn(s: GameState, amount: number): void {
  if (!(amount > 0)) return;
  // Zahlen-Schutz: nie über MAX_VALUE (sonst „unendlich“)
  s.cash = cap(s.cash + amount);
  s.runEarnings = cap(s.runEarnings + amount);
  s.totalEarnings = cap(s.totalEarnings + amount);
  if (s.cash >= MAX_VALUE || s.runEarnings >= MAX_VALUE) noteCap();
}

export function addGems(s: GameState, base: number, applyMult = true): number {
  const n = Math.max(1, Math.round(applyMult ? base * gemMult(s) : base));
  s.gems = cap(s.gems + n);
  s.stats.gemsEarned += n;
  return n;
}

export function buyBuilding(s: GameState, i: number, mode: BuyMode): boolean {
  if (buildingBlocked(s, i)) return false;
  return buyBuildingCount(s, i, buyAmount(s, i, mode), true);
}

/** Kauft genau `n` Stück (Auto-Käufer); `signal` meldet „zu teuer“ an die Oberfläche */
export function buyBuildingCount(s: GameState, i: number, n: number, signal = false): boolean {
  if (buildingBlocked(s, i)) return false;
  const cost = buildingCost(s, i, n);
  if (!(n >= 1) || cost > s.cash) {
    if (signal) emit('cantAfford', {});
    return false;
  }
  const before = milestoneCount(s.buildings[i].owned);
  const empBefore = empireCount(s);
  const wasZero = s.buildings[i].owned === 0;
  s.cash -= cost;
  s.buildings[i].owned += n;
  s.stats.buildingsBought += n;
  s.stats.boughtBy[i] += n;
  emit('buy', { building: i, amount: n });
  const after = milestoneCount(s.buildings[i].owned);
  if (after > before) {
    addXp(s, XP.milestone * (after - before));
    emit('milestone', { building: i, level: s.buildings[i].owned });
  }
  const empAfter = empireCount(s);
  if (empAfter > empBefore) {
    addXp(s, XP.empire * (empAfter - empBefore));
    emit('empire', { level: empAfter, mult: empireMultPer(s) });
  }
  if (wasZero) emit('structure', {});
  return true;
}

/** Startet einen manuellen Zyklus */
export function tapBuilding(s: GameState, i: number): boolean {
  const b = s.buildings[i];
  if (b.owned <= 0 || isManaged(s, i) || b.running || buildingBlocked(s, i)) return false;
  b.running = true;
  b.progress = 0;
  s.stats.taps++;
  return true;
}

export function hireManager(s: GameState, i: number): boolean {
  if (s.managers[i]) return false;
  const cost = managerCost(i);
  if (s.cash < cost || s.buildings[i].owned <= 0) {
    emit('cantAfford', {});
    return false;
  }
  s.cash -= cost;
  s.managers[i] = true;
  s.stats.managersHired++;
  addXp(s, XP.manager);
  // laufender manueller Zyklus geht nahtlos in Automatik über
  s.buildings[i].running = false;
  emit('manager', { building: i });
  emit('structure', {});
  return true;
}

export function buyUpgrade(s: GameState, id: string): boolean {
  const u = UPGRADE_INDEX[id];
  if (!u || s.upgrades[id] || chalActive(s, 'noupg')) return false;
  const cost = upgradeCost(s, u);
  if (s.cash < cost) {
    emit('cantAfford', {});
    return false;
  }
  s.cash -= cost;
  s.upgrades[id] = true;
  s.stats.upgradesBought++;
  addXp(s, XP.upgrade);
  emit('upgrade', { id });
  emit('structure', {});
  return true;
}

/** Kauft alle bezahlbaren Upgrades, günstigste zuerst. Gibt die Anzahl zurück. */
export function buyAllUpgrades(s: GameState): number {
  if (chalActive(s, 'noupg')) return 0;
  let n = 0;
  for (const u of UPGRADES) {
    if (s.upgrades[u.id]) continue;
    const cost = upgradeCost(s, u);
    if (cost > s.cash) break;
    s.cash -= cost;
    s.upgrades[u.id] = true;
    s.stats.upgradesBought++;
    n++;
  }
  addXp(s, XP.upgrade * n);
  if (n) {
    emit('upgrade', { id: '' });
    emit('structure', {});
  }
  return n;
}

export function labAvailable(s: GameState, id: string): boolean {
  const node = LAB_INDEX[id];
  if (!node) return false;
  return !node.requires || lab(s, node.requires) > 0;
}

export function buyLab(s: GameState, id: string): boolean {
  const node = LAB_INDEX[id];
  if (!node || !labAvailable(s, id)) return false;
  const lvl = lab(s, id);
  if (lvl >= node.maxLevel) return false;
  const cost = labCost(s, node, lvl);
  if (s.stardust < cost) {
    emit('cantAfford', {});
    return false;
  }
  s.stardust -= cost;
  s.lab[id] = lvl + 1;
  emit('lab', { id, level: lvl + 1 });
  emit('structure', {});
  return true;
}

/** Auto-Labor ab Quantenrechner Stufe 3 (abschaltbar) */
export function autoLabActive(s: GameState): boolean {
  return s.settings.autoLab && megaStage(s, 'rechner') >= 3;
}

/** Auto-Labor: kauft die günstigste bezahlbare Forschung, Einkommen bevorzugt. Gibt die Zahl der Käufe zurück. */
export function autoLab(s: GameState, maxBuys = 60): number {
  let n = 0;
  for (; n < maxBuys; n++) {
    let best: LabNode | null = null;
    let bestScore = Infinity;
    for (const node of LAB_NODES) {
      if (!labAvailable(s, node.id)) continue;
      const lvl = lab(s, node.id);
      if (lvl >= node.maxLevel) continue;
      const c = labCost(s, node, lvl);
      if (c > s.stardust) continue;
      const score = node.id === 'income' ? c * 0.5 : c;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    if (!best) break;
    const lvl = lab(s, best.id);
    s.stardust -= labCost(s, best, lvl);
    s.lab[best.id] = lvl + 1;
  }
  if (n) emit('structure', {});
  return n;
}

export function buyQuantum(s: GameState, id: string): boolean {
  const p = QUANTUM_INDEX[id];
  if (!p) return false;
  const lvl = s.qperks[id] ?? 0;
  if (lvl >= p.maxLevel) return false;
  const cost = p.cost(lvl);
  if (s.quantum < cost) {
    emit('cantAfford', {});
    return false;
  }
  s.quantum -= cost;
  s.qperks[id] = lvl + 1;
  emit('quantum', { id, level: lvl + 1 });
  emit('structure', {});
  return true;
}

// ---- Boosts & Shop ----------------------------------------------------------

export function addBoost(s: GameState, b: Omit<Boost, 'until'>, seconds: number, now: number, maxSeconds = 24 * 3600): void {
  // „Zeitdehnung“ verlängert nur echte Boosts, keine Störungen oder Zahlungen (Multiplikator < 1)
  const dur = seconds * (b.mult >= 1 ? boostDurationMult(s) : 1) * 1000;
  const existing = s.boosts.find((x) => x.id === b.id && x.until > now);
  if (existing) {
    existing.until = Math.min(Math.max(existing.until, now) + dur, now + maxSeconds * 1000);
  } else {
    s.boosts.push({ ...b, until: now + dur });
  }
  emit('boost', { label: b.label, icon: b.icon });
}

export const BOOST_DEFS = {
  x2: { id: 'x2', kind: 'income' as const, mult: 2, label: 'Boost ×2', icon: '🔥', seconds: 1800 },
  turbo: { id: 'turbo', kind: 'income' as const, mult: 5, label: 'Turbo ×5', icon: '🚀', seconds: 300 },
  frenzy: { id: 'frenzy', kind: 'income' as const, mult: 7, label: 'Kometen-Rausch ×7', icon: '☄️', seconds: 30 },
  rush: { id: 'rush', kind: 'speed' as const, mult: 3, label: 'Tempo-Rausch ×3', icon: '⚡', seconds: 60 },
};

export function grantBoost(s: GameState, key: keyof typeof BOOST_DEFS, now: number): void {
  const d = BOOST_DEFS[key];
  addBoost(s, { id: d.id, kind: d.kind, mult: d.mult, label: d.label, icon: d.icon }, d.seconds, now);
}

const scratch = newCalc();

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  cost: (s: GameState) => number;
  buy: (s: GameState, now: number) => void;
}

export function permCost(s: GameState): number {
  return 150 * Math.pow(2, s.gemPerm);
}

export const SHOP: ShopItem[] = [
  {
    id: 'x2', name: 'Boost ×2', desc: '30 Minuten doppeltes Einkommen (stapelbar)', emoji: '🔥',
    cost: () => 10, buy: (s, now) => grantBoost(s, 'x2', now),
  },
  {
    id: 'turbo', name: 'Turbo ×5', desc: '5 Minuten fünffaches Einkommen', emoji: '🚀',
    cost: () => 15, buy: (s, now) => grantBoost(s, 'turbo', now),
  },
  {
    id: 'warp1', name: 'Zeitsprung 1 h', desc: 'Sofort eine Stunde Einkommen', emoji: '⏩',
    cost: () => 20, buy: (s, now) => void timeWarp(s, 1, now),
  },
  {
    id: 'warp8', name: 'Zeitsprung 8 h', desc: 'Sofort acht Stunden Einkommen', emoji: '⏭️',
    cost: () => 120, buy: (s, now) => void timeWarp(s, 8, now),
  },
  {
    id: 'warp24', name: 'Zeitsprung 24 h', desc: 'Sofort einen ganzen Tag Einkommen', emoji: '🌀',
    cost: () => 300, buy: (s, now) => void timeWarp(s, 24, now),
  },
  {
    id: 'perm', name: 'Ewiger Verdoppler', desc: 'Einkommen ×2 für immer, auch nach Supernova und Galaxie-Sprung', emoji: '♾️',
    cost: permCost, buy: (s) => { s.gemPerm++; emit('structure', {}); },
  },
];

export function buyShop(s: GameState, id: string, now: number): boolean {
  const item = SHOP.find((x) => x.id === id);
  if (!item) return false;
  const cost = item.cost(s);
  if (s.gems < cost) {
    emit('cantAfford', {});
    return false;
  }
  s.gems -= cost;
  item.buy(s, now);
  return true;
}

// ---- Kometen ----------------------------------------------------------------

export function nextCometDelay(s: GameState): number {
  if (chalActive(s, 'storm')) return 20;
  const freq = (1 + 0.15 * lab(s, 'magnet')) * (1 + artifactBonus(s).comet + (planetTrait(s)?.comet ?? 0)) * talentBonus(s).cometFreq;
  return (120 + Math.random() * 180) / freq;
}

/**
 * Kristalle eines Kristall-Kometen (vor dem Kristall-Bonus): 12–24, dazu +1 je 3 Kommandanten-Level –
 * so viel wie etwa zwei Missionen. Im Kometensturm (alle 20 s ein Komet) nur ein Viertel.
 */
export function cometGems(s: GameState, rnd: number = Math.random()): number {
  const base = 12 + Math.floor(rnd * 13) + Math.floor(s.rank.level / 3);
  return chalActive(s, 'storm') ? Math.max(1, Math.round(base / 4)) : base;
}

export function collectComet(s: GameState, now: number, rnd = Math.random()): { kind: CometKind; text: string } {
  s.stats.cometsTapped++;
  addXp(s, XP.comet);
  const tb = talentBonus(s);
  const luck = (1 + 0.5 * lab(s, 'luck')) * (1 + artifactBonus(s).cometLuck + 0.5 * ctier(s, 'storm')) * tb.cometLuck * tb.randomLoot;
  const cashLuck = luck * tb.cashComet;
  let kind: CometKind;
  let text: string;
  if (rnd < 0.42) {
    const c = compute(s, now, scratch);
    const amount = Math.max(c.potential * 600, s.cash * 0.05 + 25) * cashLuck;
    earn(s, amount);
    kind = 'cash';
    text = `Geldregen! +${fmt(amount)} 🪙`;
  } else if (rnd < 0.72) {
    grantBoost(s, 'frenzy', now);
    kind = 'frenzy';
    text = 'Kometen-Rausch! Einkommen ×7';
  } else if (rnd < 0.85) {
    grantBoost(s, 'rush', now);
    kind = 'speed';
    text = 'Tempo-Rausch! Alles ×3 schneller';
  } else {
    const n = addGems(s, cometGems(s));
    kind = 'gems';
    text = `Kristallfund! +${n} 💎`;
  }
  emit('comet', { kind, text });
  return { kind, text };
}

export function buildingName(i: number): string {
  return BUILDINGS[i].name;
}

export type { Calc };
