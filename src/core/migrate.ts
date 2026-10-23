// Spielstand-Migrationen: alte Stände werden erweitert, nie gekürzt
import { PLANETS } from '../data/planets';
import { muteEvents } from './bus';
import { achievementCount } from './economy';
import { addXp, syncShips } from './rank';
import type { GameState } from './state';

/** Rang-XP, die ein v1-Spielstand rückwirkend für bisherige Leistungen bekommt */
export function retroXp(s: GameState): number {
  return Math.round(
    40 * achievementCount(s) +
      120 * s.totalSupernovas +
      15 * s.stats.questsDone +
      5 * s.stats.cometsTapped +
      2 * Math.min(s.stats.upgradesBought, 3000) +
      500 * s.galaxyJumps,
  );
}

export function migrate(s: GameState, from: number): void {
  if (from < 2) {
    s.stats.bestPlanet = Math.max(s.stats.bestPlanet, s.planet, s.galaxyJumps > 0 ? PLANETS.length - 1 : 0);
    muteEvents(true);
    try {
      addXp(s, retroXp(s));
    } finally {
      muteEvents(false);
    }
  }
  // immer: neue Hangar-Plätze mit Schiffen füllen, bestPlanet nachziehen
  s.stats.bestPlanet = Math.max(s.stats.bestPlanet, s.planet);
  syncShips(s);
}
