import { describe, expect, it } from 'vitest';
import { APP_VERSION, CHANGELOG, changesSince, seenVersionOf, versionNewer } from '../src/data/changelog';
import { defaultState } from '../src/core/state';

describe('Update-Hinweis', () => {
  it('vergleicht Versionen richtig', () => {
    expect(versionNewer('3.1.10', '3.1.9')).toBe(true);
    expect(versionNewer('3.1.2', '3.1.2')).toBe(false);
    expect(versionNewer('3.0.0', '3.1.0')).toBe(false);
    expect(versionNewer('4.0', '3.9.9')).toBe(true);
  });

  it('die aktuelle Version hat einen Eintrag', () => {
    expect(CHANGELOG.some((e) => e.version === APP_VERSION)).toBe(true);
  });

  it('zeigt alles seit der zuletzt gesehenen Version', () => {
    const s = defaultState(0);
    // Stand von 3.0 (kein 3.1-Hinweis gesehen): alles ab 3.1.0
    expect(changesSince(seenVersionOf(s)).map((e) => e.version)[0]).toBe('3.1.0');
    // Stand von 3.1.x: den 3.1-Hinweis schon gesehen, die kleinen Updates danach nicht
    s.tutorial.flags.v31intro = true;
    expect(changesSince(seenVersionOf(s)).map((e) => e.version)).not.toContain('3.1.0');
    expect(changesSince(seenVersionOf(s)).map((e) => e.version)).toContain('3.1.2');
    // aktuelle Version gesehen: nichts
    s.seenVersion = APP_VERSION;
    expect(changesSince(seenVersionOf(s))).toEqual([]);
  });
});
