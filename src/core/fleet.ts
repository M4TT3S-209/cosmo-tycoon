// Flotte: Expeditionen, Schiffsmodule, Artefakte
import { ARTIFACTS, ARTIFACT_INDEX, ARTIFACT_MAX_LEVEL, RARITY, RARITY_ORDER, type Rarity } from '../data/artifacts';
import { CRATE_COST, EXPEDITIONS, EXPEDITION_INDEX, MODULE_COST_MULT, MODULE_MAX, SHIP_MODULES, type ExpeditionDef, type ModuleId } from '../data/expeditions';
import { PLANETS } from '../data/planets';
import { emit } from './bus';
import { artifactBonus, gemMult, planetTrait } from './economy';
import { addXp, artifactSlots } from './rank';
import { cap } from './safe';
import type { GameState, Mission } from './state';

export function bestPlanet(s: GameState): number {
  return Math.max(s.stats.bestPlanet, s.planet, s.galaxyJumps > 0 ? PLANETS.length - 1 : 0);
}

export function destUnlocked(s: GameState, d: ExpeditionDef): boolean {
  return bestPlanet(s) >= d.minPlanet;
}

export function missionAt(s: GameState, slot: number): Mission | undefined {
  return s.fleet.missions.find((m) => m.slot === slot);
}

export function readyMissions(s: GameState, now: number): number {
  return s.fleet.missions.filter((m) => m.end <= now).length;
}

export function idleShips(s: GameState): number {
  return s.fleet.ships.filter((_, i) => !missionAt(s, i)).length;
}

/** Flugdauer in Sekunden für Schiff `slot` zum Ziel `d` */
export function expDuration(s: GameState, slot: number, d: ExpeditionDef): number {
  const ship = s.fleet.ships[slot];
  const engine = Math.min(0.5, (ship?.engine ?? 0) * 0.02);
  const art = Math.min(0.5, artifactBonus(s).expSpeed);
  const trait = planetTrait(s)?.expSpeed ?? 0;
  return d.minutes * 60 * (1 - engine) * (1 - art) * (1 - trait);
}

export function expSuccess(s: GameState, slot: number, d: ExpeditionDef): number {
  const ship = s.fleet.ships[slot];
  return Math.min(0.99, d.success + (ship?.shield ?? 0) * 0.01 + artifactBonus(s).expSuccess);
}

export function lootMult(s: GameState, slot: number): number {
  const ship = s.fleet.ships[slot];
  return (1 + (ship?.cargo ?? 0) * 0.08) * (1 + artifactBonus(s).expLoot);
}

export function startExpedition(s: GameState, slot: number, destId: string, now: number): boolean {
  const d = EXPEDITION_INDEX[destId];
  if (!d || !s.fleet.ships[slot] || missionAt(s, slot) || !destUnlocked(s, d)) return false;
  const dur = expDuration(s, slot, d);
  s.fleet.missions.push({ slot, dest: destId, start: now, end: now + dur * 1000 });
  emit('structure', {});
  return true;
}

export interface FoundArtifact {
  id: string;
  isNew: boolean;
  level: number;
  leveledUp: boolean;
  /** bei Maximal-Stufe in ⚗️ umgewandelt */
  converted: number;
}

export interface Loot {
  dest: string;
  success: boolean;
  em: number;
  gems: number;
  dust: number;
  xp: number;
  artifacts: FoundArtifact[];
}

export function rollRarity(weights: number[], rnd: () => number): Rarity {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return RARITY_ORDER[i];
  }
  return RARITY_ORDER[0];
}

export function randomArtifactOf(rarity: Rarity, rnd: () => number): string {
  const pool = ARTIFACTS.filter((a) => a.rarity === rarity);
  return pool[Math.floor(rnd() * pool.length)].id;
}

export function addEm(s: GameState, n: number): void {
  s.fleet.em += n;
  s.fleet.emEarned += n;
}

/** Fügt ein Artefakt hinzu: neu → Stufe 1, doppelt → Splitter, maximal → ⚗️ */
export function grantArtifact(s: GameState, id: string): FoundArtifact {
  const def = ARTIFACT_INDEX[id];
  const cur = s.artifacts[id];
  if (!cur) {
    s.artifacts[id] = { level: 1, shards: 0 };
    // freien Platz automatisch belegen
    if (s.equipped.length < artifactSlots(s)) s.equipped.push(id);
    return { id, isNew: true, level: 1, leveledUp: false, converted: 0 };
  }
  if (cur.level >= ARTIFACT_MAX_LEVEL) {
    const em = RARITY[def.rarity].emValue;
    addEm(s, em);
    return { id, isNew: false, level: cur.level, leveledUp: false, converted: em };
  }
  cur.shards++;
  let leveledUp = false;
  while (cur.level < ARTIFACT_MAX_LEVEL && cur.shards >= cur.level) {
    cur.shards -= cur.level;
    cur.level++;
    leveledUp = true;
  }
  if (cur.level >= ARTIFACT_MAX_LEVEL) cur.shards = 0;
  return { id, isNew: false, level: cur.level, leveledUp, converted: 0 };
}

export function claimExpedition(s: GameState, slot: number, now: number, rnd: () => number = Math.random): Loot | null {
  const m = missionAt(s, slot);
  if (!m || m.end > now) return null;
  const d = EXPEDITION_INDEX[m.dest];
  s.fleet.missions = s.fleet.missions.filter((x) => x !== m);
  if (!d) return null;
  const idx = EXPEDITIONS.indexOf(d);
  const success = rnd() < expSuccess(s, slot, d);
  const mult = lootMult(s, slot);
  const loot: Loot = { dest: d.id, success, em: 0, gems: 0, dust: 0, xp: 0, artifacts: [] };
  if (success) {
    loot.em = Math.round(d.em * mult * (1 + artifactBonus(s).em) * (0.8 + 0.4 * rnd()));
    if (rnd() < 0.35) loot.gems = Math.max(1, Math.round((1 + idx * 0.6 + rnd() * 2) * gemMult(s)));
    if (idx >= 2) loot.dust = Math.max(1, Math.floor(s.stardustEarned * 0.0004 * (idx - 1)));
    const artChance = Math.min(1, d.artifact * (1 + artifactBonus(s).expLoot * 0.5));
    const rolls = (rnd() < artChance ? 1 : 0) + (idx >= 6 && rnd() < 0.3 ? 1 : 0);
    for (let k = 0; k < rolls; k++) loot.artifacts.push(grantArtifact(s, randomArtifactOf(rollRarity(d.weights, rnd), rnd)));
    loot.xp = d.xp;
  } else {
    loot.em = Math.round(d.em * 0.25 * mult);
    loot.xp = Math.round(d.xp * 0.4);
  }
  addEm(s, loot.em);
  if (loot.gems) {
    s.gems += loot.gems;
    s.stats.gemsEarned += loot.gems;
  }
  if (loot.dust) {
    s.stardust = cap(s.stardust + loot.dust);
    s.stardustEarned = cap(s.stardustEarned + loot.dust);
    s.stardustLifetime = cap(s.stardustLifetime + loot.dust);
  }
  s.fleet.expeditions++;
  addXp(s, loot.xp);
  emit('structure', {});
  return loot;
}

export function moduleCost(level: number, mod: ModuleId): number {
  const base = SHIP_MODULES.find((m) => m.id === mod)!.base;
  return Math.ceil(base * Math.pow(MODULE_COST_MULT, level));
}

export function upgradeModule(s: GameState, slot: number, mod: ModuleId): boolean {
  const ship = s.fleet.ships[slot];
  if (!ship || ship[mod] >= MODULE_MAX) return false;
  const cost = moduleCost(ship[mod], mod);
  if (s.fleet.em < cost) {
    emit('cantAfford', {});
    return false;
  }
  s.fleet.em -= cost;
  ship[mod]++;
  emit('structure', {});
  return true;
}

/** Artefakt-Kiste: zufälliges Artefakt für ⚗️ */
export function buyCrate(s: GameState, rnd: () => number = Math.random): FoundArtifact | null {
  if (s.fleet.em < CRATE_COST) {
    emit('cantAfford', {});
    return null;
  }
  s.fleet.em -= CRATE_COST;
  s.fleet.crates++;
  const found = grantArtifact(s, randomArtifactOf(rollRarity([60, 30, 9, 1], rnd), rnd));
  emit('structure', {});
  return found;
}

export function equipArtifact(s: GameState, id: string): boolean {
  if (!s.artifacts[id] || s.equipped.includes(id) || s.equipped.length >= artifactSlots(s)) return false;
  s.equipped.push(id);
  emit('structure', {});
  return true;
}

export function unequipArtifact(s: GameState, id: string): boolean {
  if (!s.equipped.includes(id)) return false;
  s.equipped = s.equipped.filter((x) => x !== id);
  emit('structure', {});
  return true;
}
