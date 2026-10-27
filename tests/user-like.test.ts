import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';
import { simulateOffline } from '../src/core/offline';
import { newTickOut, tick } from '../src/core/tick';
import { compute, newCalc } from '../src/core/economy';
import { startBuild } from '../src/core/colonies';

// v2-Stand wie der eines schnellen Spielers: 6. Galaxie, Rang 31, 38 von 40 Prüfungs-Stufen, 24.400 Quantenkerne
const RAW = readFileSync(new URL('./fixtures/save-user-like.json', import.meta.url), 'utf8');

/** alle Zahlen im Spielstand endlich? */
function allFinite(v: unknown, path = ''): string[] {
  if (typeof v === 'number') return Number.isFinite(v) ? [] : [path];
  if (Array.isArray(v)) return v.flatMap((x, i) => allFinite(x, `${path}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => allFinite(x, `${path}.${k}`));
  return [];
}

describe('Update auf Version 3 mit einem Stand wie dem eines schnellen Spielers', () => {
  const old = JSON.parse(RAW);

  it('alles Alte bleibt exakt erhalten', () => {
    const s = deserialize(RAW, 0);
    expect(s.version).toBe(SAVE_VERSION);
    for (const k of ['cash', 'stardust', 'stardustEarned', 'quantum', 'quantumEarned', 'galaxyJumps', 'gemPerm', 'planet', 'totalSupernovas'] as const) {
      expect(s[k]).toBe(old[k]);
    }
    for (const k of ['lab', 'qperks', 'upgrades', 'achievements', 'artifacts', 'equipped', 'challengeTiers', 'rank', 'buildings', 'managers'] as const) {
      expect(s[k]).toEqual(old[k]);
    }
    // Flotte: alles bleibt, Rang 31 schaltet nur einen weiteren Hangar-Platz frei
    const { ships, ...fleet } = s.fleet;
    const { ships: oldShips, ...oldFleet } = old.fleet;
    expect(fleet).toEqual(oldFleet);
    expect(ships.slice(0, oldShips.length)).toEqual(oldShips);
    expect(s.gems).toBeGreaterThanOrEqual(old.gems);
  });

  it('neue Bereiche sind bereit: 10 Kolonien, Startpaket, 30 Talentpunkte', () => {
    const s = deserialize(RAW, 0);
    expect(Object.keys(s.colonies)).toHaveLength(10);
    expect(s.res.metal).toBeGreaterThan(0);
    expect(s.commander.talents).toEqual({});
    expect(s.rank.level - 1).toBe(30);
  });

  it('12 h offline mit allen neuen Systemen: keine kaputten Zahlen, Speichern stabil', () => {
    const s = deserialize(RAW, 0);
    startBuild(s, 0, 0, 'mine', 0);
    startBuild(s, 1, 0, 'solar', 0);
    const r = simulateOffline(s, 12 * 3600, 12 * 3600 * 1000);
    expect(r.earned).toBeGreaterThan(0);
    expect(r.built.length).toBe(2);
    expect(s.events.queue.length).toBeLessThanOrEqual(3);
    expect(allFinite(s)).toEqual([]);
    const back = deserialize(serialize(s), 12 * 3600 * 1000);
    expect(back).toEqual(s);
  });

  it('läuft eine Stunde aktiv ohne Fehler (Funksprüche, Woche, Kolonien)', () => {
    const s = deserialize(RAW, 0);
    const calc = newCalc();
    const out = newTickOut();
    const start = new Date(2026, 9, 24, 12).getTime();
    for (let t = 0; t < 3600; t++) tick(s, 1, start + t * 1000, calc, out);
    expect(s.weekly.key).toBe('2026-W43');
    expect(allFinite(s)).toEqual([]);
    expect(compute(s, start, calc).income).toBeGreaterThan(0);
  });
});
