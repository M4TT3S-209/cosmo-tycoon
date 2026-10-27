// Kommandant: Talentpunkte, Talentbaum und aktive Fähigkeiten (Version 3)
import { ABILITIES, ABILITY_INDEX, ABILITY_SLOTS, TALENTS, TALENT_INDEX, rowRequirement, type AbilityDef, type BranchId } from '../data/talents';
import { addBoost, timeWarp } from './actions';
import { emit } from './bus';
import { finishColonyBuild } from './colonies';
import { fmt } from './format';
import { talentBonus } from './talentfx';
import type { GameState } from './state';

/** Rang, ab dem der Kommandant-Bereich offen ist */
export const COMMANDER_UNLOCK_RANK = 3;

export function commanderUnlocked(s: GameState): boolean {
  return s.rank.level >= COMMANDER_UNLOCK_RANK;
}

// ---- Talentpunkte -----------------------------------------------------------

export function talentRank(s: GameState, id: string): number {
  return s.commander.talents[id] ?? 0;
}

/** 1 Punkt pro Kommandanten-Level (ab Level 2) plus Bonuspunkte */
export function talentPointsTotal(s: GameState): number {
  return Math.max(0, s.rank.level - 1) + s.commander.bonusPoints + talentBonus(s).talentPoints;
}

export function talentPointsSpent(s: GameState): number {
  let n = 0;
  for (const id in s.commander.talents) n += s.commander.talents[id] ?? 0;
  return n;
}

export function talentPointsFree(s: GameState): number {
  return Math.max(0, talentPointsTotal(s) - talentPointsSpent(s));
}

export function branchPoints(s: GameState, branch: BranchId): number {
  let n = 0;
  for (const t of TALENTS) if (t.branch === branch) n += talentRank(s, t.id);
  return n;
}

export type LearnBlock = 'max' | 'points' | 'row' | 'choice' | null;

/** Warum kann das Talent gerade nicht gelernt werden? null = es geht */
export function learnBlock(s: GameState, id: string): LearnBlock {
  const t = TALENT_INDEX[id];
  if (!t) return 'max';
  if (talentRank(s, id) >= t.max) return 'max';
  if (t.group && TALENTS.some((o) => o.group === t.group && o.id !== id && talentRank(s, o.id) > 0)) return 'choice';
  if (branchPoints(s, t.branch) < rowRequirement(t.row)) return 'row';
  if (talentPointsFree(s) < 1) return 'points';
  return null;
}

export function learnTalent(s: GameState, id: string): boolean {
  if (!commanderUnlocked(s) || learnBlock(s, id) !== null) return false;
  s.commander.talents[id] = talentRank(s, id) + 1;
  syncAbilities(s);
  emit('talent', { id });
  emit('structure', {});
  return true;
}

export function respecCost(s: GameState): number {
  return Math.min(3200, 100 * Math.pow(2, s.commander.respecs));
}

/** Alle Talente zurücksetzen (kostet Kristalle, wird mit jedem Mal teurer) */
export function respec(s: GameState): boolean {
  const cost = respecCost(s);
  if (s.gems < cost || talentPointsSpent(s) === 0) return false;
  s.gems -= cost;
  s.commander.talents = {};
  s.commander.respecs++;
  syncAbilities(s);
  emit('structure', {});
  return true;
}

// ---- Fähigkeiten ------------------------------------------------------------

export function abilityUnlocked(s: GameState, a: AbilityDef): boolean {
  if (a.talent) return talentRank(s, a.talent) > 0;
  return s.rank.level >= (a.rank ?? Infinity);
}

/** Entfernt nicht mehr freigeschaltete Fähigkeiten aus der Leiste und legt neue einmalig hinein */
export function syncAbilities(s: GameState): void {
  const c = s.commander;
  c.abilities = c.abilities.filter((id) => ABILITY_INDEX[id] && abilityUnlocked(s, ABILITY_INDEX[id]));
  for (const a of ABILITIES) {
    const flag = 'ab_' + a.id;
    if (!abilityUnlocked(s, a) || s.tutorial.flags[flag]) continue;
    s.tutorial.flags[flag] = true;
    if (c.abilities.length < ABILITY_SLOTS && !c.abilities.includes(a.id)) c.abilities.push(a.id);
  }
}

export function toggleAbility(s: GameState, id: string): boolean {
  const c = s.commander;
  const a = ABILITY_INDEX[id];
  if (!a || !abilityUnlocked(s, a)) return false;
  if (c.abilities.includes(id)) c.abilities = c.abilities.filter((x) => x !== id);
  else if (c.abilities.length < ABILITY_SLOTS) c.abilities.push(id);
  else return false;
  emit('structure', {});
  return true;
}

/** Sekunden, bis die Fähigkeit wieder bereit ist */
export function abilityReadyIn(s: GameState, id: string, now: number): number {
  return Math.max(0, ((s.commander.cooldowns[id] ?? 0) - now) / 1000);
}

export interface AbilityResult {
  ok: boolean;
  text: string;
}

export function useAbility(s: GameState, id: string, now: number): AbilityResult {
  const a = ABILITY_INDEX[id];
  if (!a || !abilityUnlocked(s, a)) return { ok: false, text: 'Noch nicht freigeschaltet' };
  if (abilityReadyIn(s, id, now) > 0) return { ok: false, text: 'Lädt noch auf' };
  let text = '';
  switch (a.id) {
    case 'overload':
      addBoost(s, { id: 'overload', kind: 'income', mult: 10, label: 'Überladung', icon: '⚡' }, 30, now, 60);
      text = '30 Sekunden lang Einkommen ×10!';
      break;
    case 'insight':
      if (s.commander.insight) return { ok: false, text: 'Geistesblitz wartet schon auf die nächste Supernova' };
      s.commander.insight = true;
      text = 'Deine nächste Supernova bringt +25 % Sternenstaub.';
      break;
    case 'jump': {
      let best = -1;
      s.fleet.missions.forEach((m, i) => {
        if (m.end > now && (best < 0 || m.end > s.fleet.missions[best].end)) best = i;
      });
      if (best < 0) return { ok: false, text: 'Gerade ist kein Schiff unterwegs' };
      s.fleet.missions[best].end = now;
      text = 'Dein Schiff ist sofort zurück – die Beute wartet in der Flotte.';
      break;
    }
    case 'shower':
      emit('cometShower', { n: 5 });
      text = 'Fünf goldene Kometen im Anflug!';
      break;
    case 'warp':
      text = `+${fmt(timeWarp(s, 0.25, now))} 🪙 aus 15 Minuten`;
      break;
    case 'build':
      if (!finishColonyBuild(s, now)) return { ok: false, text: 'Gerade läuft kein Kolonie-Bau' };
      text = 'Der Bau ist sofort fertig!';
      break;
  }
  s.commander.cooldowns[id] = now + a.cooldown * 1000;
  s.stats.abilitiesUsed++;
  emit('ability', { id });
  emit('structure', {});
  return { ok: true, text };
}
