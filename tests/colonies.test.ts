import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import {
  BASE_STORAGE, buildPlan, colonyReport, demolish, ensureColonies, exchange, exchangeRate, megaCostFor, prosperityMult, resCap,
  startBuild, startGrow, startMega, tickColonies, updateColonyBuilds, updateMega,
} from '../src/core/colonies';
import { autoLab } from '../src/core/actions';
import { talentPointsTotal } from '../src/core/commander';
import { compute, newCalc, offlineCapSec, offlineEfficiency, pendingQuantum, planetFor } from '../src/core/economy';
import { claimExpedition, startExpedition } from '../src/core/fleet';
import { simulateOffline } from '../src/core/offline';
import { galaxyJump } from '../src/core/prestige';
import { artifactSlots } from '../src/core/rank';
import type { GameState } from '../src/core/state';

// später v2-Spielstand vom Balancing-Bot (Galaxiekern, 3. Galaxie)
const LATE = readFileSync(new URL('./fixtures/save-late.json', import.meta.url), 'utf8');

function colonyState(): GameState {
  const s = deserialize(LATE, 0);
  s.rank.level = 40;
  s.commander.talents = {};
  s.res = { metal: 1e6, crystal: 1e6, deut: 1e6, alloy: 1e6, chips: 1e6 };
  return s;
}

/** baut sofort (Bauzeit überspringen) */
function quickBuild(s: GameState, p: number, slot: number, id?: string): void {
  expect(startBuild(s, p, slot, id, 0)).toBe(true);
  updateColonyBuilds(s, 1e12, []);
}

describe('Kolonien', () => {
  it('jeder erreichte Planet wird eine Kolonie, Plätze wachsen mit der Stufe', () => {
    const s = colonyState();
    expect(Object.keys(s.colonies)).toHaveLength(s.stats.bestPlanet + 1);
    expect(s.colonies['0'].slots).toHaveLength(3);
    s.colonies['0'].level = 3;
    ensureColonies(s);
    expect(s.colonies['0'].slots).toHaveLength(5);
  });

  it('Mine produziert Metall nach Wanduhr, mit Planeten-Spezialität', () => {
    const s = colonyState();
    quickBuild(s, 0, 0, 'mine');
    quickBuild(s, 0, 1, 'solar');
    s.res.metal = 0;
    tickColonies(s, 3600);
    expect(s.res.metal).toBeCloseTo(60, 5);
    // Mars: Metall ×2
    s.res.metal = 1e6;
    quickBuild(s, 2, 0, 'mine');
    quickBuild(s, 2, 1, 'solar');
    s.res.metal = 0;
    tickColonies(s, 3600);
    expect(s.res.metal).toBeCloseTo(60 + 120, 5);
  });

  it('Strommangel bremst die Verbraucher', () => {
    const s = colonyState();
    quickBuild(s, 0, 0, 'mine');
    quickBuild(s, 0, 1, 'kristall');
    // ohne Kraftwerk: keine Energie, nichts läuft
    expect(colonyReport(s, 0).eff).toBe(0);
    quickBuild(s, 0, 2, 'solar');
    // 7 Energie für 5 Verbrauch: voll
    expect(colonyReport(s, 0).eff).toBe(1);
    s.colonies['0'].slots[1] = { id: 'kristall', level: 3 };
    const r = colonyReport(s, 0);
    expect(r.eff).toBeCloseTo(7 / (2 + 3 * 3 * 1.21), 5);
  });

  it('Veredelung nur mit Zutaten, Lager begrenzt', () => {
    const s = colonyState();
    s.colonies['1'].level = 2;
    ensureColonies(s);
    quickBuild(s, 1, 0, 'schmiede');
    quickBuild(s, 1, 1, 'solar');
    s.res = { metal: 20, crystal: 1000, deut: 0, alloy: 0, chips: 0 };
    tickColonies(s, 3600);
    // nur halb so viel Metall wie gebraucht: halbe Legierung (×1,1 durch Kolonie-Stufe 2)
    expect(s.res.alloy).toBeCloseTo(5 * 1.1, 5);
    expect(s.res.metal).toBeCloseTo(0, 5);
    expect(resCap(s)).toBe(BASE_STORAGE);
    s.colonies['1'].slots[0] = null;
    s.colonies['0'].slots[0] = { id: 'mine', level: 25 };
    s.colonies['0'].slots[1] = { id: 'solar', level: 25 };
    tickColonies(s, 100 * 3600);
    expect(s.res.metal).toBe(BASE_STORAGE);
  });

  it('Bauen kostet, dauert und blockiert die Kolonie', () => {
    const s = colonyState();
    const before = s.res.metal;
    expect(startBuild(s, 0, 0, 'mine', 1000)).toBe(true);
    expect(s.res.metal).toBe(before - 60);
    expect(buildPlan(s, 0, 1, 'mine')!.block).toBe('busy');
    expect(updateColonyBuilds(s, 1000 + 30_000, [])).toBe(0);
    // Heimatwerft: Bauzeit −25 % (45 s → 33,75 s)
    expect(updateColonyBuilds(s, 1000 + 34_000, [])).toBe(1);
    expect(s.colonies['0'].slots[0]).toEqual({ id: 'mine', level: 1 });
    expect(buildPlan(s, 0, 0)!.cost.metal).toBe(Math.round(60 * 1.6));
    expect(buildPlan(s, 0, 1, 'fusion')!.block).toBe('level');
    expect(demolish(s, 0, 0)).toBe(true);
    expect(s.colonies['0'].slots[0]).toBeNull();
  });

  it('Kolonie-Ausbau: neuer Bauplatz, Wohlstand steigt', () => {
    const s = colonyState();
    const p0 = prosperityMult(s);
    expect(startGrow(s, 0, 0)).toBe(true);
    updateColonyBuilds(s, 1e12, []);
    expect(s.colonies['0'].level).toBe(2);
    expect(s.colonies['0'].slots).toHaveLength(4);
    expect(prosperityMult(s)).toBeCloseTo(p0 + 0.005);
  });

  it('offline: Kolonien produzieren über die ganze Abwesenheit, Bauten werden fertig', () => {
    const s = colonyState();
    quickBuild(s, 0, 0, 'mine');
    quickBuild(s, 0, 1, 'solar');
    expect(startBuild(s, 0, 2, 'mine', 0)).toBe(true);
    s.res.metal = 0;
    const r = simulateOffline(s, 10 * 3600, 10 * 3600 * 1000);
    expect(s.colonies['0'].slots[2]).toEqual({ id: 'mine', level: 1 });
    expect(r.built).toEqual([{ planet: 0, id: 'mine', level: 1 }]);
    // gut 10 h × 2 Minen à 60 Metall (die zweite kommt im ersten Abschnitt dazu)
    expect(r.res.metal).toBeGreaterThan(600);
    expect(r.res.metal).toBeLessThanOrEqual(1200 + 1e-6);
  });

  it('Expeditionen bringen Kolonie-Rohstoffe mit', () => {
    const s = colonyState();
    s.res.metal = 0;
    s.fleet.missions = [];
    expect(startExpedition(s, 0, 'mars', 0)).toBe(true);
    const loot = claimExpedition(s, 0, 1e12, () => 0.01)!;
    expect(loot.success).toBe(true);
    expect(loot.res.metal).toBeGreaterThan(0);
    expect(s.res.metal).toBe(loot.res.metal);
  });
});

describe('Megaprojekte', () => {
  it('kosten Rohstoffe und ⚗️, dauern, nur eins gleichzeitig', () => {
    const s = colonyState();
    s.fleet.em = 1e9;
    expect(megaCostFor(s, 'dyson', 1).res.alloy).toBe(1500);
    expect(startMega(s, 'dyson', 0)).toBe(true);
    expect(startMega(s, 'tor', 0)).toBe(false);
    expect(updateMega(s, 3599_000, [])).toBe(false);
    expect(updateMega(s, 3600_000, [])).toBe(true);
    expect(s.mega.stages.dyson).toBe(1);
    expect(megaCostFor(s, 'dyson', 2).res.alloy).toBe(4500);
  });

  it('Dyson verdoppelt das Einkommen je Stufe, Terraformer gibt Bauplätze', () => {
    const s = colonyState();
    const c = newCalc();
    const before = compute(s, 0, c).perm.colonies;
    s.mega.stages = { dyson: 3, terra: 2 };
    expect(compute(s, 0, c).perm.colonies).toBeCloseTo(before * 8);
    ensureColonies(s);
    expect(s.colonies['0'].slots).toHaveLength(5);
  });

  it('Sternentor, Quantenrechner, Chronosphäre und Archiv wirken', () => {
    const s = colonyState();
    s.stardustEarned = 1e40;
    const q = pendingQuantum(s);
    const eff = offlineEfficiency(s);
    const capSec = offlineCapSec(s);
    const slots = artifactSlots(s);
    s.mega.stages = { tor: 5, rechner: 5, chrono: 2, archiv: 3 };
    expect(pendingQuantum(s)).toBeGreaterThan(q * 1.3);
    expect(offlineCapSec(s)).toBe(capSec + 8 * 3600);
    expect(offlineEfficiency(s)).toBeGreaterThanOrEqual(eff);
    expect(artifactSlots(s)).toBe(slots + 3);
    expect(talentPointsTotal(s)).toBe(s.rank.level - 1 + 2);
    // Start einen Planeten weiter
    s.stardustEarned = 0;
    s.qperks.qstart = 2;
    expect(planetFor(s)).toBe(3);
    // Automatik-Forschung bleibt beim Galaxie-Sprung
    s.planet = 9;
    s.stardustEarned = 1e60;
    s.lab = { autobuy: 1, autoupgrade: 1, keepmgr: 1, quickstart: 10, income: 50 };
    s.qperks.qlab = 0;
    expect(galaxyJump(s)).toBe(true);
    expect(s.lab).toEqual({ autobuy: 1, autoupgrade: 1, keepmgr: 1, quickstart: 10 });
  });

  it('Auto-Labor kauft die günstigste Forschung', () => {
    const s = colonyState();
    s.lab = {};
    s.stardust = 1e6;
    expect(autoLab(s)).toBeGreaterThan(5);
    expect(s.stardust).toBeLessThan(1e6);
    expect(s.lab.income).toBeGreaterThan(0);
  });

  it('Börse tauscht 5.000 Grundstoffe gegen ⚗️', () => {
    const s = colonyState();
    expect(exchange(s, 'metal')).toBe(false);
    s.mega.stages.boerse = 1;
    const em = s.fleet.em;
    const rate = exchangeRate(s);
    expect(rate).toBeGreaterThan(0);
    expect(exchange(s, 'metal')).toBe(true);
    expect(s.fleet.em).toBe(em + rate);
    expect(s.res.metal).toBe(1e6 - 5000);
    expect(exchange(s, 'alloy')).toBe(false);
  });
});
