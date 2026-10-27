import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';

// später v2-Spielstand vom Balancing-Bot (Galaxiekern, 3. Galaxie, Labor mit Automatik)
const LATE = readFileSync(new URL('./fixtures/save-late.json', import.meta.url), 'utf8');

describe('Migration v2 → v3 (Spielstand bleibt erhalten)', () => {
  const old = JSON.parse(LATE);
  const s = deserialize(LATE, 0);

  it('alle alten Werte sind identisch', () => {
    for (const k of ['cash', 'runEarnings', 'totalEarnings', 'stardust', 'stardustEarned', 'quantum', 'quantumEarned', 'planet', 'galaxyJumps', 'gemPerm', 'totalSupernovas'] as const) {
      expect(s[k]).toBe(old[k]);
    }
    for (const k of ['lab', 'qperks', 'upgrades', 'achievements', 'artifacts', 'equipped', 'challengeTiers', 'rank', 'fleet'] as const) {
      expect(s[k]).toEqual(old[k]);
    }
    // neue Einstellung kommt dazu, alle alten bleiben
    expect(s.settings).toEqual({ ...old.settings, autoLab: true, autoCollect: true });
    expect(s.buildings).toEqual(old.buildings);
    expect(s.managers).toEqual(old.managers);
    expect(s.gems).toBeGreaterThanOrEqual(old.gems);
  });

  it('neue Systeme sind vorbereitet', () => {
    expect(s.version).toBe(SAVE_VERSION);
    expect(Object.keys(s.colonies)).toHaveLength(s.stats.bestPlanet + 1);
    expect(s.colonies['0'].slots.length).toBeGreaterThanOrEqual(3);
    expect(s.events.nextIn).toBeLessThanOrEqual(120);
    expect(s.commander.talents).toEqual({});
    // Startpaket für die ersten Gebäude
    expect(s.res.metal).toBe(800);
  });

  it('Speichern und Laden nach der Migration ist stabil', () => {
    expect(deserialize(serialize(s), 0)).toEqual(s);
  });
});

// ---- Kommandant ----------------------------------------------------------------
import { defaultState } from '../src/core/state';
import { compute, costDiscount, newCalc, pendingQuantum, startCash } from '../src/core/economy';
import {
  abilityReadyIn, learnBlock, learnTalent, respec, respecCost, syncAbilities, talentPointsFree, talentPointsTotal, useAbility,
} from '../src/core/commander';
import { hangarSlots } from '../src/core/rank';
import { supernova } from '../src/core/prestige';
import { TALENTS } from '../src/data/talents';

function commander(level = 40) {
  const s = deserialize(LATE, 0);
  s.rank.level = level;
  s.commander.talents = {};
  return s;
}

describe('Kommandant: Talente', () => {
  it('ein Talentpunkt pro Level, plus Bonuspunkte', () => {
    const s = commander(31);
    expect(talentPointsTotal(s)).toBe(30);
    s.commander.bonusPoints = 2;
    expect(talentPointsFree(s)).toBe(32);
  });

  it('Reihen brauchen Punkte im Zweig, Entweder-oder schließt aus', () => {
    const s = commander();
    expect(learnBlock(s, 'i_masse')).toBe('row');
    for (let k = 0; k < 4; k++) expect(learnTalent(s, k < 3 ? 'i_fliess' : 'i_einkauf')).toBe(true);
    expect(learnTalent(s, 'i_praez')).toBe(true);
    expect(learnBlock(s, 'i_masse')).toBe('choice');
    expect(learnTalent(s, 'i_masse')).toBe(false);
  });

  it('ohne Punkte geht nichts – und unter Level 3 ist der Bereich gesperrt', () => {
    expect(learnTalent(commander(2), 'i_fliess')).toBe(false);
    const s = commander(3);
    expect(learnTalent(s, 'i_fliess')).toBe(true);
    expect(learnTalent(s, 'i_fliess')).toBe(true);
    expect(learnBlock(s, 'i_fliess')).toBe('points');
  });

  it('Talente wirken: Einkommen, Kosten, Meilensteine, Startkapital, Hangar, Quanten', () => {
    const s = commander();
    const c = newCalc();
    const before = compute(s, 0, c).baseIncome;
    const disc = costDiscount(s);
    const cash0 = startCash(s);
    const slots = hangarSlots(s);
    s.commander.talents = { i_fliess: 5, i_einkauf: 3, i_masse: 1, f_nav: 5, f_fracht: 3, f_kund: 1, f_werft: 3, f_hangar: 1, w_stern: 5, w_assist: 3, w_quant: 1, w_nacht: 3, w_speicher: 3, w_kalt: 1 };
    expect(compute(s, 0, c).perm.talents).toBeCloseTo(1.5);
    expect(c.baseIncome).toBeCloseTo(before * 1.5, -40);
    expect(costDiscount(s) / disc).toBeCloseTo(0.85 * 0.75);
    expect(startCash(s)).toBe(cash0 * 100);
    expect(hangarSlots(s)).toBe(slots + 1);
    s.commander.talents.i_praez = 1;
    delete s.commander.talents.i_masse;
    expect(compute(s, 0, c).msBase).toBe(2.1);
    const q = pendingQuantum(s);
    s.commander.talents = {};
    expect(q).toBeGreaterThanOrEqual(pendingQuantum(s));
  });

  it('Umskillen kostet Kristalle und gibt alle Punkte zurück', () => {
    const s = commander();
    s.gems = 1000;
    learnTalent(s, 'i_fliess');
    learnTalent(s, 'w_stern');
    const cost = respecCost(s);
    expect(respec(s)).toBe(true);
    expect(s.gems).toBe(1000 - cost);
    expect(talentPointsFree(s)).toBe(talentPointsTotal(s));
    expect(respecCost(s)).toBe(cost * 2);
  });

  it('alle Talente sind lernbar (Reihen-Anforderungen erfüllbar)', () => {
    const s = commander(100);
    s.commander.bonusPoints = 100;
    for (const t of TALENTS) {
      if (t.group && TALENTS.some((o) => o.group === t.group && o.id < t.id)) continue; // nur je eine Wahl
      for (let r = 0; r < t.max; r++) expect(learnTalent(s, t.id), t.id).toBe(true);
    }
  });
});

describe('Kommandant: Fähigkeiten', () => {
  it('Zeitriss und Sofortbau gibt es über den Rang, Talent-Fähigkeiten über Talente', () => {
    const s = commander(31);
    syncAbilities(s);
    expect(s.commander.abilities).toEqual(['warp', 'build']);
    s.commander.talents = { i_fliess: 5, i_einkauf: 3, i_masse: 1, i_planung: 3, i_turbo: 2, i_monopol: 1, i_ueber: 1 };
    syncAbilities(s);
    expect(s.commander.abilities).toContain('overload');
  });

  it('Überladung: ×10 für 30 s, danach Abklingzeit', () => {
    const s = commander();
    s.commander.talents = { i_ueber: 1 };
    const c = newCalc();
    const base = compute(s, 1000, c).income;
    expect(useAbility(s, 'overload', 1000).ok).toBe(true);
    expect(compute(s, 2000, c).income).toBeCloseTo(base * 10, -40);
    expect(useAbility(s, 'overload', 2000).ok).toBe(false);
    expect(abilityReadyIn(s, 'overload', 2000)).toBeGreaterThan(500);
  });

  it('Zeitriss bringt Geld, Geistesblitz verstärkt die nächste Supernova', () => {
    const s = commander();
    const cash = s.cash;
    expect(useAbility(s, 'warp', 0).ok).toBe(true);
    expect(s.cash).toBeGreaterThan(cash);
    s.commander.talents = { w_blitz: 1 };
    s.runEarnings = 1e40;
    const t = deserialize(serialize(s), 0);
    expect(useAbility(s, 'insight', 0).ok).toBe(true);
    supernova(s);
    supernova(t);
    expect(s.stardustEarned - t.stardustEarned).toBeGreaterThan(0);
    expect(s.commander.insight).toBe(false);
  });

  it('Notsprung holt ein Schiff sofort zurück', () => {
    const s = commander();
    s.commander.talents = { f_sprung: 1 };
    s.fleet.missions = [{ slot: 0, dest: 'mond', start: 0, end: 5e6 }];
    expect(useAbility(s, 'jump', 1000).ok).toBe(true);
    expect(s.fleet.missions[0].end).toBe(1000);
    s.commander.cooldowns = {};
    expect(useAbility(s, 'jump', 2000).ok).toBe(false);
  });

  it('ein neuer Spieler hat noch keine Fähigkeiten', () => {
    const s = defaultState(0);
    syncAbilities(s);
    expect(s.commander.abilities).toEqual([]);
  });
});

// ---- Funksprüche & Fraktionen ------------------------------------------------------
import { EVENTS, EVENT_INDEX } from '../src/data/events';
import { FACTIONS, OFFERS, REP_LEVELS } from '../src/data/factions';
import {
  EVENT_QUEUE_MAX, addRep, answerEvent, buyOffer, checkChains, factionLevel, offerBought, pushEvent, tickEvents,
} from '../src/core/events';
import { simulateOffline } from '../src/core/offline';

const fixed = (v: number) => () => v;

describe('Funksprüche', () => {
  it('alle Ereignisse sind vollständig, Fortsetzungen existieren', () => {
    for (const e of EVENTS) {
      expect(e.choices.length, e.id).toBeGreaterThan(0);
      for (const c of e.choices) {
        if (c.lose) expect(c.chance, e.id).toBeDefined();
        for (const o of [c.win, c.lose]) for (const fx of o?.effects ?? []) {
          if (fx.t === 'chain') expect(EVENT_INDEX[fx.id]?.chainOnly, `${e.id} → ${fx.id}`).toBe(true);
          if (fx.t === 'rep') expect(FACTIONS.some((f) => f.id === fx.f)).toBe(true);
        }
      }
    }
    expect(EVENTS.filter((e) => !e.chainOnly).length).toBeGreaterThanOrEqual(30);
  });

  it('nach der Wartezeit kommt ein Funkspruch, höchstens drei warten', () => {
    const s = deserialize(LATE, 0);
    s.events.queue = [];
    s.events.nextIn = 5;
    tickEvents(s, 4, 0);
    expect(s.events.queue).toHaveLength(0);
    tickEvents(s, 2, 0);
    expect(s.events.queue).toHaveLength(1);
    for (let k = 0; k < 10; k++) tickEvents(s, 10000, 0);
    expect(s.events.queue).toHaveLength(EVENT_QUEUE_MAX);
  });

  it('Antworten: Kosten, Folgen, Ruf und Statistik', () => {
    const s = deserialize(LATE, 0);
    s.events.queue = [];
    pushEvent(s, 'g_rabatt', 0);
    const r = answerEvent(s, 0, 0, 0);
    expect(r.ok && r.success).toBe(true);
    // 60 s Einkommen werden als 120 s halbes Einkommen abgestottert
    const pay = s.boosts.find((b) => b.id === 'payment')!;
    expect(pay.mult).toBe(0.5);
    expect(pay.until).toBe(120000);
    expect(s.res.metal).toBeGreaterThan(0);
    expect(s.factions.gilde).toBe(20);
    expect(s.events.queue).toHaveLength(0);
    expect(s.stats.eventsAnswered).toBe(1);
  });

  it('riskante Entscheidungen: Gewinn oder Verlust je nach Würfel', () => {
    const win = deserialize(LATE, 0);
    const lose = deserialize(LATE, 0);
    for (const s of [win, lose]) {
      s.events.queue = [];
      pushEvent(s, 'g_rabatt', 0);
    }
    expect(answerEvent(win, 0, 1, 0, fixed(0.1)).success).toBe(true);
    expect(answerEvent(lose, 0, 1, 0, fixed(0.99)).success).toBe(false);
    expect(win.res.metal).toBeGreaterThan(lose.res.metal);
  });

  it('Ketten: die Fortsetzung kommt nach der angegebenen Zeit', () => {
    const s = deserialize(LATE, 0);
    s.events.queue = [];
    pushEvent(s, 'g_kredit', 0);
    answerEvent(s, 0, 0, 0);
    expect(s.events.chains.g_kredit_zahl).toBe(3600000);
    checkChains(s, 1000);
    expect(s.events.queue).toHaveLength(0);
    checkChains(s, 3600001);
    expect(s.events.queue[0].id).toBe('g_kredit_zahl');
  });

  it('nicht bezahlbare Entscheidungen werden abgelehnt', () => {
    const s = deserialize(LATE, 0);
    s.events.queue = [];
    s.gems = 0;
    pushEvent(s, 'g_auktion', 0);
    expect(answerEvent(s, 0, 1, 0).ok).toBe(false);
    expect(s.events.queue).toHaveLength(1);
  });

  it('offline treffen Funksprüche ein', () => {
    const s = deserialize(LATE, 0);
    s.events.queue = [];
    const r = simulateOffline(s, 8 * 3600, 0);
    expect(r.events).toBeGreaterThan(0);
    expect(s.events.queue.length).toBeLessThanOrEqual(EVENT_QUEUE_MAX);
  });
});

describe('Fraktionen', () => {
  it('Ruf-Stufen, nie unter 0, Diplomat ×1,5', () => {
    const s = commander();
    addRep(s, 'akademie', REP_LEVELS[1]);
    expect(factionLevel(s, 'akademie')).toBe(2);
    addRep(s, 'akademie', -99999);
    expect(s.factions.akademie).toBe(0);
    s.commander.talents = { g_diplomat: 1 };
    addRep(s, 'flotte', 100);
    expect(s.factions.flotte).toBe(150);
  });

  it('Stufen geben Vorteile: Gilde 5 verdoppelt das Einkommen, Akademie 3 gibt Talentpunkte', () => {
    const s = commander();
    const c = newCalc();
    const before = compute(s, 0, c).perm.talents;
    const points = talentPointsTotal(s);
    s.factions = { gilde: REP_LEVELS[4], akademie: REP_LEVELS[2] };
    expect(compute(s, 0, c).perm.talents).toBeCloseTo(before * 2);
    expect(talentPointsTotal(s)).toBe(points + 2);
  });

  it('Wochen-Shop: Stufe nötig, einmal pro Woche', () => {
    const s = commander();
    s.fleet.em = 1e6;
    s.gems = 1e4;
    const o = OFFERS.find((x) => x.id === 'o_res')!;
    expect(buyOffer(s, o.id, 0).ok).toBe(false);
    s.factions.gilde = REP_LEVELS[0];
    expect(buyOffer(s, o.id, 0).ok).toBe(true);
    expect(offerBought(s, o.id, 0)).toBe(true);
    expect(buyOffer(s, o.id, 0).ok).toBe(false);
    expect(buyOffer(s, o.id, 8 * 86400000).ok).toBe(true);
  });
});
