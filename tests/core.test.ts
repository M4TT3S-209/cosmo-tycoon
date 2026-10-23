import { describe, expect, it } from 'vitest';
import { fmt, fmtTime, fmtClock, setNotation } from '../src/core/format';
import { defaultState, hydrate } from '../src/core/state';
import {
  buildingCost, maxAffordable, pendingStardust, earningsForNextDust, compute, newCalc, planetFor,
  nextMilestone, milestoneCount,
} from '../src/core/economy';
import { buyBuilding, hireManager, buyUpgrade, tapBuilding, buyLab, timeWarp, collectComet } from '../src/core/actions';
import { supernova, galaxyJump } from '../src/core/prestige';
import { computeOffline, claimDaily, canClaimDaily, dayKey, ensureQuests, questProgress } from '../src/core/meta';
import { tick, newTickOut } from '../src/core/tick';
import { exportCode, importCode, serialize, deserialize } from '../src/core/save';
import { UPGRADES } from '../src/data/upgrades';
import { PLANETS } from '../src/data/planets';

describe('Formatierung', () => {
  it('kurze Notation mit deutschem Komma', () => {
    setNotation('short');
    expect(fmt(0)).toBe('0');
    expect(fmt(4.5)).toBe('4,5');
    expect(fmt(999)).toBe('999');
    expect(fmt(1234)).toBe('1,23 K');
    expect(fmt(12_345_678)).toBe('12,3 Mio');
    expect(fmt(999_999)).toBe('1 Mio');
    expect(fmt(1e66)).toBe('1 aa');
    expect(fmt(Infinity)).toBe('∞');
  });
  it('wissenschaftliche Notation', () => {
    setNotation('sci');
    expect(fmt(12345)).toBe('1,23e4');
    setNotation('short');
  });
  it('Zeiten', () => {
    expect(fmtTime(45)).toBe('45 s');
    expect(fmtTime(3725)).toBe('1 h 2 min');
    expect(fmtTime(90000)).toBe('1 T 1 h');
    expect(fmtClock(65)).toBe('1:05');
  });
});

describe('Wirtschaft', () => {
  it('Kostenreihe und Max-Kauf passen zusammen', () => {
    const s = defaultState(0);
    s.cash = 1e6;
    const n = maxAffordable(s, 1, s.cash);
    expect(buildingCost(s, 1, n)).toBeLessThanOrEqual(s.cash);
    expect(buildingCost(s, 1, n + 1)).toBeGreaterThan(s.cash);
  });
  it('Meilensteine', () => {
    expect(milestoneCount(24)).toBe(0);
    expect(milestoneCount(25)).toBe(1);
    expect(nextMilestone(30)).toBe(50);
  });
  it('Kauf verringert Geld und erhöht Bestand', () => {
    const s = defaultState(0);
    s.cash = 100;
    expect(buyBuilding(s, 0, 1)).toBe(true);
    expect(s.buildings[0].owned).toBe(2);
    expect(s.cash).toBeCloseTo(100 - 4 * 1.07);
  });
  it('Tippen startet einen Zyklus, der Geld bringt', () => {
    const s = defaultState(0);
    const calc = newCalc();
    const out = newTickOut();
    expect(tapBuilding(s, 0)).toBe(true);
    const before = s.cash;
    tick(s, 1.01, 0, calc, out);
    expect(s.cash).toBeGreaterThan(before);
    expect(s.buildings[0].running).toBe(false);
  });
  it('Manager automatisieren', () => {
    const s = defaultState(0);
    s.cash = 1e4;
    expect(hireManager(s, 0)).toBe(true);
    const calc = newCalc();
    const out = newTickOut();
    tick(s, 10, 0, calc, out);
    expect(out.cycles[0]).toBeGreaterThanOrEqual(9);
  });
  it('Upgrades multiplizieren den Ertrag', () => {
    const s = defaultState(0);
    const calc = newCalc();
    compute(s, 0, calc);
    const r0 = calc.rev[0];
    const u = UPGRADES.find((x) => x.target === 0)!;
    s.cash = u.cost;
    expect(buyUpgrade(s, u.id)).toBe(true);
    compute(s, 0, calc);
    expect(calc.rev[0]).toBeCloseTo(r0 * 3);
  });
});

describe('Prestige', () => {
  it('Sternenstaub wächst mit den Einnahmen', () => {
    const s = defaultState(0);
    s.runEarnings = 1e9;
    expect(pendingStardust(s)).toBe(10);
    s.runEarnings = 1e20;
    expect(pendingStardust(s)).toBeGreaterThan(100);
    const need = earningsForNextDust(s);
    s.runEarnings = need * 1.0001;
    expect(pendingStardust(s)).toBeGreaterThanOrEqual(Math.floor(Math.pow(10, 0)) + 1);
  });
  it('Supernova setzt den Lauf zurück und bringt einen Planeten', () => {
    const s = defaultState(0);
    s.runEarnings = 2e9;
    s.cash = 5e8;
    s.buildings[3].owned = 50;
    expect(supernova(s)).toBe(true);
    expect(s.stardust).toBeGreaterThanOrEqual(10);
    expect(s.cash).toBe(4);
    expect(s.buildings[3].owned).toBe(0);
    expect(s.planet).toBe(1);
    expect(planetFor(s)).toBe(1);
  });
  it('Labor-Knoten kosten Sternenstaub', () => {
    const s = defaultState(0);
    s.stardust = 100;
    expect(buyLab(s, 'income')).toBe(true);
    expect(s.lab.income).toBe(1);
    expect(s.stardust).toBe(95);
    expect(buyLab(s, 'autoupgrade')).toBe(false); // Voraussetzung fehlt
  });
  it('Galaxie-Sprung erst am Galaxiekern', () => {
    const s = defaultState(0);
    s.stardustEarned = PLANETS[PLANETS.length - 1].need;
    expect(galaxyJump(s)).toBe(false);
    s.planet = PLANETS.length - 1;
    expect(galaxyJump(s)).toBe(true);
    expect(s.quantum).toBeGreaterThan(0);
    expect(s.stardustEarned).toBe(0);
    expect(s.planet).toBe(0);
  });
});

describe('Meta', () => {
  it('Offline-Einnahmen sind gedeckelt', () => {
    const s = defaultState(0);
    s.managers[0] = true;
    const r = computeOffline(s, 10 * 3600, 0);
    expect(r.capped).toBe(true);
    expect(r.counted).toBe(2 * 3600);
    expect(r.amount).toBeGreaterThan(0);
  });
  it('Tägliche Belohnung einmal pro Tag, Serie zählt hoch', () => {
    const s = defaultState(0);
    const day1 = new Date(2026, 0, 1, 12).getTime();
    expect(canClaimDaily(s, day1)).toBe(true);
    claimDaily(s, day1);
    expect(canClaimDaily(s, day1)).toBe(false);
    claimDaily(s, day1 + 86400000);
    expect(s.daily.streak).toBe(2);
    expect(s.daily.last).toBe(dayKey(day1 + 86400000));
  });
  it('Missionen werden erzeugt und messen Fortschritt', () => {
    const s = defaultState(0);
    ensureQuests(s);
    expect(s.quests).toHaveLength(3);
    for (const q of s.quests) expect(questProgress(s, q)[0]).toBeGreaterThanOrEqual(0);
  });
  it('Zeitsprung und Kometen bringen Geld', () => {
    const s = defaultState(0);
    s.managers[0] = true;
    expect(timeWarp(s, 1, 0)).toBeGreaterThan(0);
    const before = s.cash;
    collectComet(s, 0, 0.1);
    expect(s.cash).toBeGreaterThan(before);
  });
});

describe('Speichern', () => {
  it('Roundtrip über JSON', () => {
    const s = defaultState(0);
    s.cash = 12345;
    s.lab.income = 3;
    const t = deserialize(serialize(s), 0);
    expect(t.cash).toBe(12345);
    expect(t.lab.income).toBe(3);
  });
  it('Fehlende Felder werden ergänzt', () => {
    const s = hydrate({ version: 1, cash: 5, buildings: [{ owned: 7 }] }, 0);
    expect(s.cash).toBe(5);
    expect(s.buildings[0].owned).toBe(7);
    expect(s.buildings).toHaveLength(10);
    expect(s.settings.sound).toBe(true);
  });
  it('Export-Code ist prüfbar', () => {
    const s = defaultState(0);
    s.gems = 777;
    const code = exportCode(s);
    expect(importCode(code, 0).gems).toBe(777);
    expect(() => importCode(code.slice(0, -4) + 'AAAA', 0)).toThrow();
    expect(() => importCode('hallo', 0)).toThrow();
  });
});
