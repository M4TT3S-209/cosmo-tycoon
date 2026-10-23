// Prüfungen: Sonderläufe mit Einschränkung und dauerhafter Belohnung
import { CHALLENGE_INDEX, CHALLENGE_TIERS, CHALLENGE_UNLOCK_SUPERNOVAS, COUNTDOWN_SECONDS } from '../data/challenges';
import { emit } from './bus';
import { ctier } from './economy';
import { resetRun } from './prestige';
import { XP, addXp, syncShips } from './rank';
import type { GameState } from './state';

export function challengesUnlocked(s: GameState): boolean {
  return s.totalSupernovas >= CHALLENGE_UNLOCK_SUPERNOVAS || s.galaxyJumps > 0;
}

/** Ziel der nächsten Stufe oder null, wenn alle Stufen geschafft sind */
export function challengeGoal(s: GameState, id: string): number | null {
  const t = ctier(s, id);
  const def = CHALLENGE_INDEX[id];
  if (!def || t >= CHALLENGE_TIERS) return null;
  return def.goals[t];
}

export function startChallenge(s: GameState, id: string): boolean {
  const goal = challengeGoal(s, id);
  if (!challengesUnlocked(s) || goal === null || s.challenge.active) return false;
  resetRun(s);
  s.challenge = { active: id, goal };
  emit('structure', {});
  return true;
}

/** Bricht die laufende Prüfung ab – der Lauf wird zurückgesetzt */
export function abortChallenge(s: GameState): void {
  if (!s.challenge.active) return;
  s.challenge = { active: '', goal: 0 };
  resetRun(s);
  emit('structure', {});
}

export function countdownLeft(s: GameState): number {
  return Math.max(0, COUNTDOWN_SECONDS - s.runTime);
}

/** Zweimal pro Sekunde: Ziel erreicht? Zeit abgelaufen? */
export function checkChallenge(s: GameState): void {
  const id = s.challenge.active;
  if (!id) return;
  if (s.runEarnings >= s.challenge.goal) {
    const tier = ctier(s, id) + 1;
    s.challengeTiers[id] = tier;
    s.challenge = { active: '', goal: 0 };
    s.stats.challengesDone++;
    addXp(s, XP.challenge * tier);
    syncShips(s);
    emit('challengeDone', { id, tier });
    emit('structure', {});
  } else if (id === 'countdown' && s.runTime > COUNTDOWN_SECONDS) {
    s.challenge = { active: '', goal: 0 };
    emit('challengeFailed', { id });
    emit('structure', {});
  }
}
