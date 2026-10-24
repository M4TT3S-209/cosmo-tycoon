import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { defaultState, type GameState } from '../src/core/state';
import { autoSpend, autoStatus } from '../src/core/autobuy';
import { buyBuilding } from '../src/core/actions';
import { buildingBlocked, buildingCost, compute, empireCount, newCalc } from '../src/core/economy';
import { startChallenge } from '../src/core/challenges';
import { BUILDING_COUNT } from '../src/data/buildings';
import { UPGRADES } from '../src/data/upgrades';

// später Spielstand vom Balancing-Bot (Galaxiekern, 3. Galaxie, Labor mit Auto-Käufer)
const LATE = readFileSync(new URL('./fixtures/save-late.json', import.meta.url), 'utf8');
const late = () => deserialize(LATE, 0);
const ALL = { buildings: true, upgrades: true };
const calc = newCalc();
const income = (s: GameState) => compute(s, 0, calc).baseIncome;

/** wie Bild 5 vom iPhone: frischer Lauf mit niedrigen Stufen, aber riesigem Geld */
function catchUp(): GameState {
  const s = late();
  [189, 185, 180, 178, 176, 170, 169, 180, 169, 155].forEach((v, i) => (s.buildings[i].owned = v));
  s.upgrades = {};
  s.cash = 1e46;
  return s;
}

/** Stand, in dem Einzelstufen praktisch unbezahlbar sind (alle Anlagen auf 3000) */
function expensive(): GameState {
  const s = defaultState(0);
  s.managers = s.managers.map(() => true);
  for (const b of s.buildings) b.owned = 3000;
  return s;
}

/** der alte Auto-Käufer bis v2.0: immer die billigste Anlage, solange sie ≤ 25 % des Geldes kostet */
function oldAutoBuy(s: GameState): void {
  for (let n = 0; n < 100000; n++) {
    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < BUILDING_COUNT; i++) {
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

describe('Schlauer Auto-Käufer', () => {
  it('holt riesige Geldmengen in einem Aufruf auf – und das schnell', () => {
    const s = catchUp();
    const before = s.stats.buildingsBought;
    const t0 = performance.now();
    autoSpend(s, 0, ALL);
    expect(performance.now() - t0).toBeLessThan(100);
    expect(s.stats.buildingsBought - before).toBeGreaterThan(5000);
    expect(Object.keys(s.upgrades).length).toBeGreaterThan(30);
  });

  it('ist mindestens so gut wie der alte Käufer ohne Mengenbremse – und mit Upgrades weit besser', () => {
    const a = catchUp();
    const b = catchUp();
    const c = catchUp();
    oldAutoBuy(a);
    autoSpend(b, 0, { buildings: true, upgrades: false });
    autoSpend(c, 0, ALL);
    expect(income(b)).toBeGreaterThanOrEqual(income(a));
    expect(income(c)).toBeGreaterThan(income(a) * 1000);
  });

  it('vollendet einen Meilenstein (Tempo ×2) samt Imperium-Bonus', () => {
    const s = expensive();
    s.buildings[9].owned = 1249;
    s.cash = buildingCost(s, 9, 1) * 1.5;
    const emp = empireCount(s);
    autoSpend(s, 0, ALL);
    expect(s.buildings[9].owned).toBe(1250);
    expect(empireCount(s)).toBe(emp + 1);
  });

  it('kauft das Imperium-Paket über mehrere Anlagen', () => {
    const s = expensive();
    s.buildings[8].owned = 740;
    s.buildings[9].owned = 745;
    s.cash = (buildingCost(s, 8, 10) + buildingCost(s, 9, 5)) * 1.2;
    const emp = empireCount(s);
    autoSpend(s, 0, { buildings: true, upgrades: false });
    expect(Math.min(s.buildings[8].owned, s.buildings[9].owned)).toBeGreaterThanOrEqual(750);
    expect(empireCount(s)).toBe(emp + 1);
  });

  it('spart für ein starkes Upgrade, das bald bezahlbar ist, und kauft es dann', () => {
    const s = expensive();
    // alles, was im Verhältnis zum Einkommen billig ist, gilt als gekauft
    for (const u of UPGRADES) {
      if (u.cost > income(s) * 10) break;
      s.upgrades[u.id] = true;
    }
    const next = UPGRADES.find((u) => !s.upgrades[u.id])!;
    s.cash = next.cost - income(s) * 5;
    expect(s.cash).toBeGreaterThan(0);
    const cash = s.cash;
    autoSpend(s, 0, ALL);
    // er wartet, statt das Geld in schlechte Einzelstufen zu stecken – auf das lohnendste nahe Upgrade
    expect(s.cash).toBe(cash);
    expect(autoStatus.target?.saving).toBe(true);
    const target = UPGRADES.find((u) => autoStatus.target!.label.includes(u.name))!;
    expect(target).toBeTruthy();
    expect(s.upgrades[target.id]).toBeFalsy();
    s.cash = target.cost * 1.001;
    autoSpend(s, 0, ALL);
    expect(s.upgrades[target.id]).toBe(true);
  });

  it('hält sich an Prüfungen: „Nur 5 Anlagen“ und „Ohne Upgrades“', () => {
    const s = late();
    startChallenge(s, 'five');
    s.cash = 1e40;
    const start = s.buildings.map((b) => b.owned);
    autoSpend(s, 0, ALL);
    for (let i = 5; i < BUILDING_COUNT; i++) expect(s.buildings[i].owned).toBe(start[i]);
    expect(s.buildings[0].owned).toBeGreaterThan(start[0]);

    const t = late();
    t.challenge = { active: '', goal: 0 };
    startChallenge(t, 'noupg');
    t.cash = 1e40;
    autoSpend(t, 0, ALL);
    expect(Object.keys(t.upgrades)).toHaveLength(0);
  });

  it('nur der Auto-Upgrader: kauft Upgrades und Manager, aber keine Anlagen', () => {
    const s = defaultState(0);
    s.buildings[1].owned = 5;
    s.cash = 1e9;
    autoSpend(s, 0, { buildings: false, upgrades: true });
    expect(s.managers[0] && s.managers[1]).toBe(true);
    expect(Object.keys(s.upgrades).length).toBeGreaterThan(0);
    expect(s.buildings[0].owned).toBe(1);
    expect(s.buildings[1].owned).toBe(5);
  });
});
