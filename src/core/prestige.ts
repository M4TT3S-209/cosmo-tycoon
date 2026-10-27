// Supernova (Rebirth) und Galaxie-Sprung (2. Prestige-Ebene)
import { BUILDING_COUNT } from '../data/buildings';
import { emit } from './bus';
import { canGalaxyJump, lab, pendingQuantum, pendingStardust, planetFor, qlvl, startCash } from './economy';
import { regenerateQuests } from './meta';
import { XP, addXp, syncShips } from './rank';
import { cap } from './safe';
import { megaStage } from './talentfx';
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
  let gain = pendingStardust(s);
  if (gain < 1) return false;
  // Fähigkeit „Geistesblitz“: diese Supernova bringt 25 % mehr
  if (s.commander.insight) {
    gain = Math.floor(cap(gain * 1.25));
    s.commander.insight = false;
  }
  const runTime = s.runTime;
  s.stardust = cap(s.stardust + gain);
  s.stardustEarned = cap(s.stardustEarned + gain);
  s.stardustLifetime = cap(s.stardustLifetime + gain);
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

const TOR_KEEP = ['keepmgr', 'quickstart', 'autobuy', 'autoupgrade'];

export function galaxyJump(s: GameState): boolean {
  if (!canGalaxyJump(s)) return false;
  const gain = pendingQuantum(s);
  s.quantum = cap(s.quantum + gain);
  s.quantumEarned = cap(s.quantumEarned + gain);
  s.galaxyJumps++;
  const keep = 0.1 * qlvl(s, 'qlab');
  const nextLab: Record<string, number> = {};
  for (const k in s.lab) {
    const v = Math.floor(s.lab[k] * keep);
    if (v > 0) nextLab[k] = v;
  }
  // Sternentor Stufe 3: die Automatik-Forschung bleibt
  if (megaStage(s, 'tor') >= 3) for (const k of TOR_KEEP) if (s.lab[k]) nextLab[k] = Math.max(nextLab[k] ?? 0, s.lab[k]);
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

/** Stillstand: seit so vielen Sekunden Laufzeit … */
const STALL_WINDOW = 300;
/** … weniger als 3 % Zuwachs, bei mindestens 20 % des bisherigen Sternenstaubs und 20 min Laufzeit */
const STALL_GROWTH = 1.03;
const STALL_MIN_SHARE = 0.2;
const STALL_MIN_RUN = 1200;
/** Verlauf des möglichen Sternenstaubs im aktuellen Lauf (nur im Speicher, je Spielstand) */
const novaHists = new WeakMap<GameState, { t: number; p: number }[]>();

/**
 * Auto-Supernova-Perk: löst aus, sobald sich der Sternenstaub mindestens verdoppelt –
 * oder wenn der Lauf kaum noch wächst (dann lohnt der Neustart mehr als das Warten).
 */
export function autoSupernovaReady(s: GameState): boolean {
  if (qlvl(s, 'qauto') < 1 || !s.settings.autoSupernova) return false;
  const p = pendingStardust(s);
  const S = Math.max(1, s.stardustEarned);
  if (p >= 1 && p >= S) return true;
  // Verlauf führen: neuer Lauf → zurücksetzen, sonst etwa jede Minute ein Messpunkt
  let novaHist = novaHists.get(s);
  if (!novaHist) novaHists.set(s, (novaHist = []));
  const t = s.runTime;
  const last = novaHist[novaHist.length - 1];
  if (last && t < last.t) novaHist.length = 0;
  if (!novaHist.length || t - novaHist[novaHist.length - 1].t >= 60) novaHist.push({ t, p });
  while (novaHist.length > 2 && novaHist[1].t <= t - STALL_WINDOW) novaHist.shift();
  if (t < STALL_MIN_RUN || p < Math.max(1, STALL_MIN_SHARE * s.stardustEarned)) return false;
  const old = novaHist[0];
  return t - old.t >= STALL_WINDOW && p < old.p * STALL_GROWTH;
}
