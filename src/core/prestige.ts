// Supernova (Rebirth) und Galaxie-Sprung (2. Prestige-Ebene)
import { BUILDING_COUNT } from '../data/buildings';
import { emit } from './bus';
import { canGalaxyJump, lab, pendingQuantum, pendingStardust, planetFor, qlvl, startCash } from './economy';
import { regenerateQuests } from './meta';
import { XP, addXp, syncShips } from './rank';
import type { GameState } from './state';

/** Setzt den aktuellen Lauf zurück (Geld, Anlagen, Upgrades, ggf. Manager) */
export function resetRun(s: GameState): void {
  const keepMgr = lab(s, 'keepmgr') > 0;
  const quick = lab(s, 'quickstart');
  s.cash = startCash(s);
  s.runEarnings = 0;
  s.runTime = 0;
  s.upgrades = {};
  for (let i = 0; i < BUILDING_COUNT; i++) {
    const b = s.buildings[i];
    b.owned = i < quick ? 10 : i === 0 ? 1 : 0;
    b.progress = 0;
    b.running = false;
    if (!keepMgr) s.managers[i] = false;
  }
}

export function supernova(s: GameState): boolean {
  const gain = pendingStardust(s);
  if (gain < 1) return false;
  const runTime = s.runTime;
  s.stardust += gain;
  s.stardustEarned += gain;
  s.stardustLifetime += gain;
  s.supernovas++;
  s.totalSupernovas++;
  s.stats.bestRunEarnings = Math.max(s.stats.bestRunEarnings, s.runEarnings);
  if (!s.stats.fastestSupernova || runTime < s.stats.fastestSupernova) s.stats.fastestSupernova = runTime;
  const newPlanet = planetFor(s);
  const planetChanged = newPlanet > s.planet;
  s.planet = Math.max(s.planet, newPlanet);
  s.stats.bestPlanet = Math.max(s.stats.bestPlanet, s.planet);
  // eine laufende Prüfung endet mit der Supernova
  s.challenge = { active: '', goal: 0 };
  resetRun(s);
  addXp(s, XP.supernova + Math.round(10 * Math.log10(1 + gain)));
  syncShips(s);
  regenerateQuests(s);
  emit('supernova', { gain, planetChanged, planet: s.planet });
  emit('structure', {});
  return true;
}

export function galaxyJump(s: GameState): boolean {
  if (!canGalaxyJump(s)) return false;
  const gain = pendingQuantum(s);
  s.quantum += gain;
  s.quantumEarned += gain;
  s.galaxyJumps++;
  const keep = 0.1 * qlvl(s, 'qlab');
  const nextLab: Record<string, number> = {};
  for (const k in s.lab) {
    const v = Math.floor(s.lab[k] * keep);
    if (v > 0) nextLab[k] = v;
  }
  s.lab = nextLab;
  s.stardust = 0;
  s.stardustEarned = 0;
  s.supernovas = 0;
  s.planet = planetFor(s);
  s.challenge = { active: '', goal: 0 };
  resetRun(s);
  addXp(s, XP.galaxy);
  regenerateQuests(s);
  emit('galaxy', { gain });
  emit('structure', {});
  return true;
}

/** Auto-Supernova-Perk: löst aus, sobald sich der Sternenstaub mindestens verdoppelt */
export function autoSupernovaReady(s: GameState): boolean {
  if (qlvl(s, 'qauto') < 1 || !s.settings.autoSupernova) return false;
  const p = pendingStardust(s);
  return p >= 1 && p >= Math.max(1, s.stardustEarned);
}
