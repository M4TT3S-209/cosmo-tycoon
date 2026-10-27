import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize } from '../src/core/save';
import { WEEKLY_MODS, weeklyModFor } from '../src/data/weekly';
import { claimWeekly, syncWeekly, weekEndsIn, weeklyClaimable, weeklyContract, weeklyMod, weeklyProgress } from '../src/core/weekly';
import { talentBonus } from '../src/core/talentfx';
import { startBuild, tickColonies, updateColonyBuilds } from '../src/core/colonies';
import { defaultState, type GameState } from '../src/core/state';

const LATE = readFileSync(new URL('./fixtures/save-late.json', import.meta.url), 'utf8');
const MONDAY = new Date(2026, 9, 19, 12).getTime();
const DAY = 86400000;

function state(): GameState {
  return deserialize(LATE, 0);
}

/** eine Wochen-Kennung, deren Bedingung `id` ist */
function keyFor(id: string): string {
  for (let w = 1; w < 400; w++) {
    const key = `${2026 + Math.floor(w / 53)}-W${String((w % 53) + 1).padStart(2, '0')}`;
    if (weeklyModFor(key)?.id === id) return key;
  }
  throw new Error('keine Woche für ' + id);
}

describe('Wochen-Ereignis', () => {
  it('erst nach der ersten Supernova', () => {
    const s = defaultState(0);
    expect(syncWeekly(s, MONDAY)).toBe(false);
    expect(weeklyMod(s)).toBeNull();
  });

  it('jede Kalenderwoche eine Bedingung und ein Auftrag – stabil innerhalb der Woche', () => {
    const s = state();
    expect(syncWeekly(s, MONDAY)).toBe(true);
    const key = s.weekly.key;
    const contract = s.weekly.contract;
    expect(weeklyMod(s)).not.toBeNull();
    expect(weeklyContract(s)?.id).toBe(contract);
    expect(syncWeekly(s, MONDAY + 5 * DAY)).toBe(false);
    expect(syncWeekly(s, MONDAY + 7 * DAY)).toBe(true);
    expect(s.weekly.key).not.toBe(key);
  });

  it('jede Bedingung kommt vor', () => {
    for (const m of WEEKLY_MODS) expect(keyFor(m.id)).toBeTruthy();
  });

  it('Auftrag: Fortschritt ab Wochenbeginn, Belohnung einmal', () => {
    const s = state();
    syncWeekly(s, MONDAY);
    const c = weeklyContract(s)!;
    expect(weeklyProgress(s)).toBe(0);
    expect(claimWeekly(s)).toBeNull();
    // Zähler hochsetzen, wie es das Spiel tun würde
    const bump = (n: number) => {
      switch (c.id) {
        case 'nova': s.totalSupernovas += n; break;
        case 'funk': s.stats.eventsAnswered += n; break;
        case 'komet': s.stats.cometsTapped += n; break;
        case 'mission': s.stats.questsDone += n; break;
        case 'bau': s.stats.colonyBuilds += n; break;
        case 'flotte': s.fleet.expeditions += n; break;
        case 'kraft': s.stats.abilitiesUsed += n; break;
      }
    };
    bump(c.goal - 1);
    expect(weeklyClaimable(s)).toBe(false);
    bump(5);
    expect(weeklyProgress(s)).toBe(c.goal);
    const gems = s.gems;
    const em = s.fleet.em;
    const lines = claimWeekly(s, () => 0.5)!;
    expect(lines).toHaveLength(3);
    expect(s.gems).toBeGreaterThan(gems);
    expect(s.fleet.em).toBeGreaterThan(em);
    expect(s.stats.weeklyDone).toBe(1);
    expect(claimWeekly(s)).toBeNull();
    // neue Woche: neuer Auftrag, wieder offen
    syncWeekly(s, MONDAY + 7 * DAY);
    expect(s.weekly.claimed).toBe(false);
    expect(weeklyProgress(s)).toBe(0);
  });

  it('Bedingungen wirken', () => {
    const s = state();
    s.weekly.key = keyFor('komet');
    expect(talentBonus(s).cometFreq).toBeCloseTo(2);
    s.weekly.key = keyFor('industrie');
    expect(talentBonus(s).cost).toBeCloseTo(0.9);
    s.weekly.key = keyFor('sonne');
    expect(talentBonus(s).expSuccess).toBeCloseTo(-0.1);
  });

  it('Rohstoff-Boom verdoppelt die Kolonie-Produktion', () => {
    const s = state();
    s.res = { metal: 1e5, crystal: 1e5, deut: 0, alloy: 0, chips: 0 };
    startBuild(s, 0, 0, 'mine', 0);
    updateColonyBuilds(s, 1e12, []);
    startBuild(s, 0, 1, 'solar', 0);
    updateColonyBuilds(s, 1e12, []);
    s.res.metal = 0;
    s.weekly.key = keyFor('boom');
    tickColonies(s, 3600);
    expect(s.res.metal).toBeCloseTo(120, 5);
  });

  it('Woche endet Montag 0 Uhr', () => {
    const sunday = new Date(2026, 9, 25, 23, 0).getTime();
    expect(weekEndsIn(sunday)).toBe(3600000);
  });
});
