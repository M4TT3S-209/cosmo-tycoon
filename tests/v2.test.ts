import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultState } from '../src/core/state';
import { deserialize, exportCode, importCode, serialize } from '../src/core/save';
import { compute, newCalc, offlineCapSec, buildingCost, pendingStardust } from '../src/core/economy';
import { simulateOffline } from '../src/core/offline';
import { buyBuilding, buyUpgrade, hireManager, tapBuilding } from '../src/core/actions';
import { supernova } from '../src/core/prestige';
import {
  buyCrate, claimExpedition, equipArtifact, expDuration, grantArtifact, startExpedition, unequipArtifact, upgradeModule,
} from '../src/core/fleet';
import { abortChallenge, challengeGoal, checkChallenge, startChallenge } from '../src/core/challenges';
import { addXp, artifactSlots, hangarSlots, xpForNext } from '../src/core/rank';
import { tick, newTickOut } from '../src/core/tick';
import { EXPEDITIONS } from '../src/data/expeditions';
import { ARTIFACT_MAX_LEVEL } from '../src/data/artifacts';

const V1 = readFileSync(new URL('./fixtures/save-v1.json', import.meta.url), 'utf8');

function midGame() {
  const s = deserialize(V1, 0);
  s.equipped = [];
  return s;
}

describe('Migration v1 → v2 (Spielstand bleibt erhalten)', () => {
  const old = JSON.parse(V1);
  const s = deserialize(V1, 0);

  it('alle alten Werte sind identisch', () => {
    expect(s.cash).toBe(old.cash);
    expect(s.totalEarnings).toBe(old.totalEarnings);
    expect(s.stardust).toBe(old.stardust);
    expect(s.stardustEarned).toBe(old.stardustEarned);
    expect(s.planet).toBe(old.planet);
    expect(s.lab).toEqual(old.lab);
    expect(s.upgrades).toEqual(old.upgrades);
    expect(s.achievements).toEqual(old.achievements);
    expect(s.buildings.map((b) => b.owned)).toEqual(old.buildings.map((b: { owned: number }) => b.owned));
    expect(s.managers).toEqual(old.managers);
    expect(s.quests).toEqual(old.quests);
    expect(s.totalSupernovas).toBe(old.totalSupernovas);
    expect(s.settings).toMatchObject(old.settings);
  });
  it('Kristalle gehen nie verloren (Rang-Belohnungen kommen dazu)', () => {
    expect(s.gems).toBeGreaterThanOrEqual(old.gems);
  });
  it('neue Systeme sind vorbereitet', () => {
    expect(s.version).toBe(2);
    expect(s.rank.level).toBeGreaterThan(1);
    expect(s.fleet.ships.length).toBe(hangarSlots(s));
    expect(s.stats.bestPlanet).toBe(old.planet);
    expect(s.challenge.active).toBe('');
  });
  it('Speichern und Laden nach der Migration ist stabil', () => {
    const again = deserialize(serialize(s), 0);
    expect(again).toEqual(s);
  });
  it('alte Export-Codes lassen sich weiter importieren', () => {
    const v1state = JSON.parse(V1);
    const code = exportCode(v1state);
    expect(importCode(code, 0).cash).toBe(old.cash);
  });
  it('Listen werden nicht gekürzt', () => {
    const t = deserialize(serialize(s), 0);
    t.fleet.ships.push({ engine: 3, cargo: 0, shield: 0 }, { engine: 1, cargo: 1, shield: 1 });
    t.fleet.missions.push({ slot: 0, dest: 'mond', start: 0, end: 1 }, { slot: 1, dest: 'mond', start: 0, end: 1 });
    t.equipped.push('greifer', 'bohrkopf', 'antenne');
    const u = deserialize(serialize(t), 0);
    expect(u.fleet.ships.length).toBe(t.fleet.ships.length);
    expect(u.fleet.missions.length).toBe(2);
    expect(u.equipped.length).toBe(3);
  });
});

describe('Offline-Automatik', () => {
  it('Auto-Käufer und Auto-Upgrader kaufen offline weiter', () => {
    const s = midGame();
    s.lab.autoupgrade = 1;
    s.lab.autobuy = 1;
    s.settings.autoBuy = true;
    s.settings.autoUpgrade = true;
    s.managers = s.managers.map(() => true);
    const before = s.stats.buildingsBought;
    const r = simulateOffline(s, 3 * 3600, 0);
    expect(r.earned).toBeGreaterThan(0);
    expect(r.bought).toBeGreaterThan(0);
    expect(s.stats.buildingsBought).toBe(before + r.bought);
  });
  it('ohne Automatik wird nur Geld gutgeschrieben', () => {
    const s = defaultState(0);
    s.managers[0] = true;
    const r = simulateOffline(s, 3600, 0);
    expect(r.bought).toBe(0);
    expect(r.earned).toBeGreaterThan(0);
  });
  it('Offline-Speicher deckelt die Zeit', () => {
    const s = defaultState(0);
    s.managers[0] = true;
    const r = simulateOffline(s, 100 * 3600, 0);
    expect(r.counted).toBe(offlineCapSec(s));
    expect(r.capped).toBe(true);
  });
});

describe('Flotte & Artefakte', () => {
  it('Expedition läuft über die Wanduhr und bringt Beute', () => {
    const s = midGame();
    const d = EXPEDITIONS[0];
    expect(startExpedition(s, 0, d.id, 1000)).toBe(true);
    expect(startExpedition(s, 0, d.id, 1000)).toBe(false); // Schiff schon unterwegs
    expect(claimExpedition(s, 0, 2000)).toBeNull(); // noch nicht fertig
    const end = 1000 + expDuration(s, 0, d) * 1000;
    const loot = claimExpedition(s, 0, end + 1, () => 0.01)!;
    expect(loot.success).toBe(true);
    expect(loot.em).toBeGreaterThan(0);
    expect(s.fleet.em).toBe(loot.em);
    expect(s.fleet.missions).toHaveLength(0);
  });
  it('gesperrte Ziele können nicht angeflogen werden', () => {
    const s = midGame();
    s.planet = 0;
    s.stats.bestPlanet = 0;
    expect(startExpedition(s, 0, 'kern', 0)).toBe(false);
  });
  it('Artefakte: neu → Stufe 1, doppelt → Splitter, Maximum → ⚗️', () => {
    const s = midGame();
    expect(grantArtifact(s, 'greifer').isNew).toBe(true);
    expect(s.equipped).toContain('greifer');
    grantArtifact(s, 'greifer');
    expect(s.artifacts.greifer.level).toBe(2);
    for (let i = 0; i < 200; i++) grantArtifact(s, 'greifer');
    expect(s.artifacts.greifer.level).toBe(ARTIFACT_MAX_LEVEL);
    const em = s.fleet.em;
    expect(grantArtifact(s, 'greifer').converted).toBeGreaterThan(0);
    expect(s.fleet.em).toBeGreaterThan(em);
  });
  it('ausgerüstete Artefakte erhöhen den Ertrag, Plätze sind begrenzt', () => {
    const s = midGame();
    const c = newCalc();
    compute(s, 0, c);
    const r0 = c.rev[0];
    grantArtifact(s, 'greifer');
    compute(s, 0, c);
    expect(c.rev[0]).toBeCloseTo(r0 * 1.25);
    unequipArtifact(s, 'greifer');
    compute(s, 0, c);
    expect(c.rev[0]).toBeCloseTo(r0);
    const ids = ['bohrkopf', 'antenne', 'solarsplitter', 'sternkarte', 'kristallstaub', 'thermos', 'meteorit', 'plasmazelle', 'zahnrad'];
    for (const id of ids) grantArtifact(s, id);
    expect(s.equipped.length).toBe(artifactSlots(s));
    expect(equipArtifact(s, 'greifer')).toBe(false);
  });
  it('Module und Artefakt-Kiste kosten ⚗️', () => {
    const s = midGame();
    s.fleet.em = 1000;
    expect(upgradeModule(s, 0, 'engine')).toBe(true);
    expect(s.fleet.ships[0].engine).toBe(1);
    expect(buyCrate(s, () => 0.5)).not.toBeNull();
    expect(s.fleet.em).toBeLessThan(1000);
  });
});

describe('Prüfungen', () => {
  it('Start setzt den Lauf zurück, Einschränkung wirkt, Ziel gibt Belohnung', () => {
    const s = midGame();
    expect(startChallenge(s, 'inflation')).toBe(true);
    expect(s.runEarnings).toBe(0);
    const normal = defaultState(0);
    expect(buildingCost(s, 0, 1) / buildingCost(normal, 0, 1)).toBeGreaterThan(5);
    s.runEarnings = challengeGoal(s, 'inflation')!;
    checkChallenge(s);
    expect(s.challengeTiers.inflation).toBe(1);
    expect(s.challenge.active).toBe('');
  });
  it('Ohne Upgrades / Nur 5 Anlagen / Ohne Manager', () => {
    const s = midGame();
    startChallenge(s, 'noupg');
    s.cash = 1e30;
    expect(buyUpgrade(s, 'u0_0')).toBe(false);
    abortChallenge(s);
    startChallenge(s, 'five');
    s.cash = 1e30;
    expect(buyBuilding(s, 7, 1)).toBe(false);
    expect(buyBuilding(s, 2, 1)).toBe(true);
    abortChallenge(s);
    startChallenge(s, 'nomgr');
    s.cash = 1e30;
    hireManager(s, 0);
    expect(tapBuilding(s, 0)).toBe(true);
    const out = newTickOut();
    tick(s, 100, 0, newCalc(), out);
    expect(out.cycles[0]).toBeLessThanOrEqual(1);
  });
  it('Supernova beendet eine laufende Prüfung', () => {
    const s = midGame();
    startChallenge(s, 'slow');
    s.runEarnings = 1e9;
    expect(pendingStardust(s)).toBeGreaterThan(0);
    supernova(s);
    expect(s.challenge.active).toBe('');
  });
});

describe('Rang', () => {
  it('XP steigern das Level und geben Kristalle', () => {
    const s = defaultState(0);
    const gems = s.gems;
    addXp(s, xpForNext(1) + xpForNext(2));
    expect(s.rank.level).toBe(3);
    expect(s.gems).toBeGreaterThan(gems);
  });
  it('Hangar-Plätze wachsen mit dem Rang', () => {
    const s = midGame();
    const slots = hangarSlots(s);
    while (s.rank.level < 50) addXp(s, xpForNext(s.rank.level));
    expect(hangarSlots(s)).toBeGreaterThan(slots);
    expect(s.fleet.ships.length).toBe(hangarSlots(s));
  });
});
