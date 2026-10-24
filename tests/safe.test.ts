import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { MAX_VALUE, cap, repairNumbers } from '../src/core/safe';
import { earn } from '../src/core/actions';
import { compute, maxAffordable, newCalc } from '../src/core/economy';
import { tick, newTickOut } from '../src/core/tick';
import { autoSpend } from '../src/core/autobuy';
import { simulateOffline } from '../src/core/offline';
import { galaxyJump, supernova } from '../src/core/prestige';
import { ensureQuests, updateQuests } from '../src/core/meta';
import { PLANETS } from '../src/data/planets';
import type { GameState } from '../src/core/state';

const V1 = readFileSync(new URL('./fixtures/save-v1.json', import.meta.url), 'utf8');
const LATE = readFileSync(new URL('./fixtures/save-late.json', import.meta.url), 'utf8');

/** Pfad der ersten kaputten Zahl (∞, NaN oder über MAX_VALUE) im Spielstand, sonst null */
function badNumber(node: unknown, path = 's'): string | null {
  if (typeof node === 'number') return Number.isFinite(node) && Math.abs(node) <= MAX_VALUE ? null : `${path} = ${node}`;
  if (typeof node !== 'object' || node === null) return null;
  for (const [k, v] of Object.entries(node)) {
    const bad = badNumber(v, `${path}.${k}`);
    if (bad) return bad;
  }
  return null;
}

/** Multiplikatoren weit jenseits dessen, was JavaScript darstellen kann */
function extreme(): GameState {
  const s = deserialize(LATE, 0);
  s.stardustEarned = s.stardust = 1e300;
  s.quantumEarned = 1e300;
  s.gemPerm = 5000; // 2^5000 = „unendlich“
  s.qperks.qincome = 40;
  s.lab.income = 60;
  for (const b of s.buildings) b.owned = 5000;
  s.managers = s.managers.map(() => true);
  s.cash = 1e300;
  return s;
}

describe('Zahlen-Schutz', () => {
  it('cap deckelt bei 1e300 und macht aus NaN eine 0', () => {
    expect(cap(Infinity)).toBe(MAX_VALUE);
    expect(cap(-Infinity)).toBe(-MAX_VALUE);
    expect(cap(NaN)).toBe(0);
    expect(cap(12345)).toBe(12345);
  });

  it('Geld bleibt auch bei „unendlich“ viel Einkommen endlich', () => {
    const s = deserialize(LATE, 0);
    earn(s, Infinity);
    expect([s.cash, s.runEarnings, s.totalEarnings]).toEqual([MAX_VALUE, MAX_VALUE, MAX_VALUE]);
    earn(s, 1e305);
    expect(s.cash).toBe(MAX_VALUE);
  });

  it('Einkommen und Multiplikatoren bleiben endlich', () => {
    const c = compute(extreme(), 0, newCalc());
    for (const v of [c.income, c.baseIncome, c.potential, c.perm.total, ...c.rev, ...c.unit]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThanOrEqual(MAX_VALUE);
    }
  });

  it('Spielschleife, Auto-Käufer, Offline, Supernova und Galaxie-Sprung: keine kaputte Zahl, kein Einfrieren', () => {
    const s = extreme();
    const calc = newCalc();
    const out = newTickOut();
    const t0 = performance.now();
    for (let k = 0; k < 300; k++) tick(s, 1, k * 1000, calc, out);
    autoSpend(s, 0, { buildings: true, upgrades: true });
    simulateOffline(s, 24 * 3600, 0);
    expect(badNumber(s)).toBeNull();
    s.runEarnings = MAX_VALUE;
    expect(supernova(s)).toBe(true);
    expect(badNumber(s)).toBeNull();
    s.planet = PLANETS.length - 1;
    expect(galaxyJump(s)).toBe(true);
    for (let k = 0; k < 300; k++) tick(s, 1, k * 1000, calc, out);
    expect(badNumber(s)).toBeNull();
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it('„Wie viele kann ich kaufen?“ endet auch mit unendlich viel Geld', () => {
    const s = deserialize(LATE, 0);
    const n = maxAffordable(s, 0, Infinity);
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });

  it('Speichern schreibt nie leere Werte: ∞ wird 1e300, NaN der zuletzt gespeicherte Wert', () => {
    const s = deserialize(LATE, 0);
    const previous = serialize(s);
    const cash = s.cash;
    const owned = s.buildings[3].owned;
    s.cash = NaN;
    s.buildings[3].owned = NaN;
    s.stardust = Infinity;
    const back = deserialize(serialize(s, previous), 0);
    expect(back.cash).toBe(cash);
    expect(back.buildings[3].owned).toBe(owned);
    expect(back.stardust).toBe(MAX_VALUE);
    expect(badNumber(back)).toBeNull();
  });

  it('„Verdiene X“-Missionen bleiben an der Obergrenze nicht hängen', () => {
    const s = deserialize(LATE, 0);
    s.totalEarnings = MAX_VALUE;
    s.quests = [{ id: 1, type: 'earn', target: -1, goal: 1e20, base: 1e299, reward: 5, done: false }];
    updateQuests(s);
    expect(s.quests[0].done).toBe(true);
    s.quests = [];
    for (let k = 0; k < 20; k++) {
      ensureQuests(s);
      expect(s.quests.some((q) => q.type === 'earn')).toBe(false);
      s.quests = [];
    }
  });

  it('echte Spielstände bleiben unverändert (nichts zu reparieren)', () => {
    for (const raw of [V1, LATE]) {
      const s = deserialize(raw, 0);
      const before = JSON.stringify(s);
      expect(repairNumbers(s)).toBe(0);
      expect(JSON.stringify(s)).toBe(before);
    }
  });
});
