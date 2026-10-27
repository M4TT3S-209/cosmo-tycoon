import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { COLLECTOR_COST, autoCollect, buyCollector, collectorAvailable, ensureQuests } from '../src/core/meta';
import { slowTick } from '../src/core/tick';
import { simulateOffline } from '../src/core/offline';
import { defaultState, type GameState } from '../src/core/state';

const LATE = readFileSync(new URL('./fixtures/save-late.json', import.meta.url), 'utf8');

function state(): GameState {
  const s = deserialize(LATE, 0);
  ensureQuests(s);
  return s;
}

/** erfüllt die erste Mission (Fortschritt so setzen, wie es das Spiel täte) */
function finishFirstQuest(s: GameState): void {
  const q = s.quests[0];
  q.done = true;
}

describe('Kristall-Sammler', () => {
  it('erst ab dem ersten Galaxie-Sprung im Shop, kostet 20.000 💎, nur einmal', () => {
    const fresh = defaultState(0);
    fresh.gems = 1e6;
    expect(collectorAvailable(fresh)).toBe(false);
    expect(buyCollector(fresh)).toBe(false);

    const s = state();
    s.gems = COLLECTOR_COST - 1;
    expect(collectorAvailable(s)).toBe(true);
    expect(buyCollector(s)).toBe(false);
    s.gems = COLLECTOR_COST + 5;
    expect(buyCollector(s)).toBe(true);
    expect(s.gems).toBe(5);
    expect(s.gemCollector).toBe(true);
    s.gems = 1e6;
    expect(buyCollector(s)).toBe(false);
  });

  it('holt fertige Missionen ab und würfelt neue – ohne Kettenreaktion', () => {
    const s = state();
    s.gemCollector = true;
    finishFirstQuest(s);
    const gems = s.gems;
    const done = s.stats.questsDone;
    expect(autoCollect(s)).toBeGreaterThan(0);
    expect(s.gems).toBeGreaterThan(gems);
    expect(s.stats.questsDone).toBe(done + 1);
    expect(s.quests).toHaveLength(3);
    expect(s.quests.every((q) => !q.done)).toBe(true);
    // im nächsten Schritt ist nichts Neues fertig
    expect(autoCollect(s)).toBe(0);
  });

  it('läuft im Spiel-Takt und lässt sich ausschalten', () => {
    const s = state();
    s.gemCollector = true;
    finishFirstQuest(s);
    slowTick(s, 0);
    expect(s.quests.every((q) => !q.done)).toBe(true);

    s.settings.autoCollect = false;
    finishFirstQuest(s);
    slowTick(s, 0);
    expect(s.quests[0].done).toBe(true);
  });

  it('ohne Kauf passiert nichts', () => {
    const s = state();
    finishFirstQuest(s);
    expect(autoCollect(s)).toBe(0);
    expect(s.quests[0].done).toBe(true);
  });

  it('nach der Offline-Zeit: fertige Missionen werden beim ersten Takt abgeholt', () => {
    const s = state();
    s.gemCollector = true;
    simulateOffline(s, 3 * 3600, 3 * 3600 * 1000);
    const gems = s.gems;
    slowTick(s, 3 * 3600 * 1000);
    expect(s.quests.every((q) => !q.done)).toBe(true);
    expect(s.gems).toBeGreaterThanOrEqual(gems);
  });
});

// ---- Kristall-Kometen (3.1.1) ------------------------------------------------------
import { cometGems, collectComet } from '../src/core/actions';

describe('Kristall-Kometen', () => {
  it('bringen etwa zwei Missionen, wachsen mit dem Rang, Kometensturm nur ein Viertel', () => {
    const s = state();
    s.rank.level = 1;
    expect(cometGems(s, 0)).toBe(12);
    expect(cometGems(s, 0.999)).toBe(24);
    s.rank.level = 38;
    expect(cometGems(s, 0)).toBe(24);
    s.challenge = { active: 'storm', goal: 1e9 };
    expect(cometGems(s, 0)).toBe(6);
  });

  it('kommen bei 15 % der Kometen und nutzen den Kristall-Bonus', () => {
    const s = state();
    s.challenge = { active: '', goal: 0 };
    s.rank.level = 38;
    const gems = s.gems;
    expect(collectComet(s, 0, 0.84).kind).toBe('speed');
    expect(collectComet(s, 0, 0.85).kind).toBe('gems');
    expect(s.gems - gems).toBeGreaterThanOrEqual(24);
  });
});
