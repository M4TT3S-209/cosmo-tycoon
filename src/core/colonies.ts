// Kolonien: Planeten besiedeln, Rohstoffe produzieren, Gebäude ausbauen, Megaprojekte (Version 3)
import {
  BUILDING_MAX, COLONY_BUILDINGS, COLONY_BUILDING_INDEX, COLONY_LEVEL_MAX, COLONY_TRAITS, COLONY_UNLOCK_PLANET, COST_GROWTH_COLONY,
  MEGA_UNLOCK_PLANET, PROD_GROWTH,
  TIME_GROWTH_COLONY, colonyLevelCost, colonyLevelTime, type ColonyBuildingDef,
} from '../data/colonies';
import { PLANETS } from '../data/planets';
import { MEGAPROJECTS, MEGA_COST_GROWTH, MEGA_HOURS, MEGA_INDEX, MEGA_STAGES } from '../data/megaprojects';
import { weeklyModFor } from '../data/weekly';
import { emit, type GameEvents } from './bus';
import { cap } from './safe';
import { megaStage, talentBonus } from './talentfx';
import type { ColonyState, GameState, ResId, Resources } from './state';

export const RES_IDS: ResId[] = ['metal', 'crystal', 'deut', 'alloy', 'chips'];
type ResMap = Partial<Record<ResId, number>>;

/** Kolonien gibt es ab dem Mars */
export function coloniesUnlocked(s: GameState): boolean {
  return s.stats.bestPlanet >= COLONY_UNLOCK_PLANET || s.galaxyJumps > 0;
}

/** höchster je erreichter Planet */
export function reachedPlanet(s: GameState): number {
  return Math.max(s.stats.bestPlanet, s.planet, s.galaxyJumps > 0 ? PLANETS.length - 1 : 0);
}

/** Exotische Materie in Funksprüchen und an der Börse wächst mit dem Fortschritt (wie die Modul-Preise) */
export function emScale(s: GameState): number {
  return 1 + reachedPlanet(s) * 0.3;
}

export function newColony(): ColonyState {
  return { level: 1, slots: [null, null, null], build: null, grow: 0 };
}

/** Bauplätze: 2 + Kolonie-Stufe + Terraformer */
export function colonySlots(s: GameState, c: ColonyState): number {
  return 2 + c.level + megaStage(s, 'terra');
}

/** Startpaket für die ersten Gebäude (Mine, Kristallbohrer, Kraftwerk in zwei, drei Kolonien) */
export const STARTER_RES: ResMap = { metal: 800, crystal: 400, deut: 150 };

/**
 * Notvorrat: Fördert keine Kolonie Metall (bzw. Kristall), wird bis zu diesem Bestand aufgefüllt –
 * genug für Mine, Kristallbohrer und Solarkraftwerk. So kann man sich nie festbauen.
 */
export const RES_FLOOR: Partial<Record<ResId, number>> = { metal: 200, crystal: 100 };

/** Füllt den Notvorrat auf. Gibt zurück, was dazukam. */
export function resourceFloor(s: GameState): ResMap {
  const added: ResMap = {};
  if (!coloniesUnlocked(s)) return added;
  let rates: Record<ResId, number> | null = null;
  for (const k in RES_FLOOR) {
    const id = k as ResId;
    const floor = RES_FLOOR[id] ?? 0;
    if (s.res[id] >= floor) continue;
    rates ??= totalRates(s);
    if (rates[id] > 0) continue;
    added[id] = floor - s.res[id];
    s.res[id] = floor;
  }
  if (Object.keys(added).length) emit('resFloor', {});
  return added;
}

/** Legt für alle erreichten Planeten eine Kolonie an und füllt neue Bauplätze auf (entfernt nie etwas) */
export function ensureColonies(s: GameState): void {
  if (!coloniesUnlocked(s)) return;
  if (Object.keys(s.colonies).length === 0) addResources(s, STARTER_RES);
  for (let p = 0; p <= reachedPlanet(s); p++) {
    const key = String(p);
    let c = s.colonies[key];
    if (!c) c = s.colonies[key] = newColony();
    while (c.slots.length < colonySlots(s, c)) c.slots.push(null);
  }
}

/** Summe aller Gebäude- und Kolonie-Stufen (Maß für die Größe deines Kolonie-Reichs) */
export function totalColonyLevels(s: GameState): number {
  let n = 0;
  for (const k in s.colonies) {
    const c = s.colonies[k];
    n += c.level - 1;
    for (const b of c.slots) if (b) n += b.level;
  }
  return n;
}

/** Wohlstand: +0,5 % Einkommen pro Ausbau-Stufe (alle Stufen aller Kolonien: höchstens etwa ×23) */
export const PROSPERITY_PER_LEVEL = 0.005;

export function prosperityMult(s: GameState): number {
  return 1 + PROSPERITY_PER_LEVEL * Math.min(5000, totalColonyLevels(s));
}

/**
 * Rohstoff-Belohnungen (Funksprüche, Expeditionen, Shop) wachsen mit der Produktion der Grundstoffe:
 * ab 2.000 pro Stunde entsprechen sie immer etwa gleich vielen Minuten Produktion – so wachsen sie mit,
 * schaukeln sich aber nicht auf (mehr Stufen → mehr Belohnung → noch mehr Stufen).
 */
export function resScale(s: GameState): number {
  const r = totalRates(s);
  return Math.max(1, (Math.max(0, r.metal) + Math.max(0, r.crystal) + Math.max(0, r.deut)) / 2000);
}

/** Faktor für Produktion, Verbrauch und Energie einer Gebäude-Stufe */
export function levelFactor(level: number): number {
  return level <= 0 ? 0 : level * Math.pow(PROD_GROWTH, level - 1);
}

// ---- Lager ----------------------------------------------------------------------

export const BASE_STORAGE = 20000;

/** Lager-Grenze je Rohstoff (alle Lager aller Kolonien zusammen) */
export function resCap(s: GameState): number {
  let n = BASE_STORAGE;
  for (const k in s.colonies) {
    for (const b of s.colonies[k].slots) {
      const st = b ? COLONY_BUILDING_INDEX[b.id]?.storage : 0;
      if (st) n += st * levelFactor(b!.level);
    }
  }
  return n;
}

export function addResources(s: GameState, r: ResMap): void {
  const limit = resCap(s);
  for (const k of RES_IDS) {
    const v = r[k];
    if (!v) continue;
    s.res[k] = Math.max(0, Math.min(Math.max(limit, s.res[k]), cap(s.res[k] + v)));
  }
}

export function hasResources(s: GameState, r: ResMap): boolean {
  return RES_IDS.every((k) => (r[k] ?? 0) <= s.res[k]);
}

export function payResources(s: GameState, r: ResMap): boolean {
  if (!hasResources(s, r)) return false;
  for (const k of RES_IDS) s.res[k] -= r[k] ?? 0;
  return true;
}

// ---- Produktion --------------------------------------------------------------------

function traitOf(p: number) {
  return COLONY_TRAITS[p] ?? COLONY_TRAITS[0];
}

/** Ausstoß-Faktor eines Gebäudes in Kolonie p (Spezialität, Kolonie-Stufe, Terraformer) */
function outputMult(s: GameState, p: number, c: ColonyState, def: ColonyBuildingDef, res?: ResId): number {
  const t = traitOf(p);
  let m = (t.all ?? 1) * (t.building?.[def.id] ?? 1) * (1 + 0.1 * (c.level - 1));
  if (res) m *= t.prod?.[res] ?? 1;
  if (megaStage(s, 'terra') >= MEGA_STAGES) m *= 1.5;
  // Wochen-Ereignis
  const week = weeklyModFor(s.weekly.key)?.id;
  if (res && week === 'boom') m *= 2;
  if (def.id === 'solar' && week === 'sonne') m *= 3;
  return m;
}

/** Fusionsreaktoren brauchen Deuterium im Lager */
function fuel(s: GameState, def: ColonyBuildingDef): number {
  for (const r in def.consume) if (!(s.res[r as ResId] > 0)) return 0;
  return 1;
}

export interface BuildingOutput {
  produce: ResMap;
  consume: ResMap;
  /** positiv = erzeugt, negativ = verbraucht */
  energy: number;
  storage: number;
}

/** Nennwerte eines Gebäudes auf Stufe `level` in Kolonie p (pro Stunde, bei voller Energie) */
export function buildingOutput(s: GameState, p: number, id: string, level: number): BuildingOutput {
  const c = s.colonies[String(p)];
  const def = COLONY_BUILDING_INDEX[id];
  const out: BuildingOutput = { produce: {}, consume: {}, energy: 0, storage: 0 };
  if (!c || !def) return out;
  const f = levelFactor(level);
  for (const r in def.produce) out.produce[r as ResId] = (def.produce[r as ResId] ?? 0) * f * outputMult(s, p, c, def, r as ResId);
  for (const r in def.consume) out.consume[r as ResId] = (def.consume[r as ResId] ?? 0) * f;
  out.energy = def.energy > 0 ? def.energy * f * outputMult(s, p, c, def) : def.energy * f;
  out.storage = (def.storage ?? 0) * f;
  return out;
}

export interface ColonyReport {
  energyProd: number;
  energyUse: number;
  /** Anteil der Produktion, der bei der Energie-Lage läuft */
  eff: number;
  /** Netto-Produktion pro Stunde (bei ausreichend Rohstoffen) */
  rate: Record<ResId, number>;
}

export function colonyReport(s: GameState, p: number): ColonyReport {
  const c = s.colonies[String(p)];
  const rate: Record<ResId, number> = { metal: 0, crystal: 0, deut: 0, alloy: 0, chips: 0 };
  const rep: ColonyReport = { energyProd: 0, energyUse: 0, eff: 1, rate };
  if (!c) return rep;
  for (const b of c.slots) {
    if (!b) continue;
    const def = COLONY_BUILDING_INDEX[b.id];
    if (!def) continue;
    const f = levelFactor(b.level);
    if (def.energy > 0) rep.energyProd += def.energy * f * outputMult(s, p, c, def) * fuel(s, def);
    else rep.energyUse += -def.energy * f;
  }
  rep.eff = rep.energyUse <= 0 ? 1 : Math.min(1, rep.energyProd / rep.energyUse);
  for (const b of c.slots) {
    if (!b) continue;
    const def = COLONY_BUILDING_INDEX[b.id];
    if (!def) continue;
    const f = levelFactor(b.level);
    // Kraftwerke laufen, solange Brennstoff da ist; Verbraucher nur so weit, wie Energie da ist
    const e = def.energy > 0 ? fuel(s, def) : rep.eff;
    for (const k in def.produce) rate[k as ResId] += (def.produce[k as ResId] ?? 0) * f * e * outputMult(s, p, c, def, k as ResId);
    for (const k in def.consume) rate[k as ResId] -= (def.consume[k as ResId] ?? 0) * f * e;
  }
  return rep;
}

/** Netto-Produktion aller Kolonien pro Stunde */
export function totalRates(s: GameState): Record<ResId, number> {
  const out: Record<ResId, number> = { metal: 0, crystal: 0, deut: 0, alloy: 0, chips: 0 };
  for (const k in s.colonies) {
    const r = colonyReport(s, Number(k)).rate;
    for (const id of RES_IDS) out[id] += r[id];
  }
  return out;
}

/** Produktion für `dt` Sekunden: erst Grundstoffe, dann Veredelung (nur mit vorhandenen Rohstoffen) */
export function tickColonies(s: GameState, dt: number): void {
  if (!(dt > 0)) return;
  const limit = resCap(s);
  const h = dt / 3600;
  for (const pass of [0, 1]) {
    for (const k in s.colonies) {
      const p = Number(k);
      const c = s.colonies[k];
      const eff = colonyReport(s, p).eff;
      for (const b of c.slots) {
        if (!b) continue;
        const def = COLONY_BUILDING_INDEX[b.id];
        if (!def) continue;
        const isConverter = !!def.consume;
        if (isConverter !== (pass === 1)) continue;
        const f = levelFactor(b.level) * h * (def.energy > 0 ? fuel(s, def) : eff);
        // Veredeler: nur so viel, wie die Zutaten hergeben
        let ratio = 1;
        for (const r in def.consume) {
          const need = (def.consume[r as ResId] ?? 0) * f;
          if (need > 0) ratio = Math.min(ratio, s.res[r as ResId] / need);
        }
        ratio = Math.max(0, Math.min(1, ratio));
        for (const r in def.consume) s.res[r as ResId] = Math.max(0, s.res[r as ResId] - (def.consume[r as ResId] ?? 0) * f * ratio);
        for (const r in def.produce) {
          const add = (def.produce[r as ResId] ?? 0) * f * ratio * outputMult(s, p, c, def, r as ResId);
          s.res[r as ResId] = Math.min(Math.max(limit, s.res[r as ResId]), cap(s.res[r as ResId] + add));
        }
      }
    }
  }
}

// ---- Bauen -----------------------------------------------------------------------

export function buildCost(id: string, toLevel: number): ResMap {
  const def = COLONY_BUILDING_INDEX[id];
  const out: ResMap = {};
  if (!def) return out;
  const k = Math.pow(COST_GROWTH_COLONY, toLevel - 1);
  for (const r in def.cost) out[r as ResId] = Math.round((def.cost[r as ResId] ?? 0) * k);
  return out;
}

export function buildTime(p: number, id: string, toLevel: number): number {
  const def = COLONY_BUILDING_INDEX[id];
  if (!def) return 0;
  return def.time * Math.pow(TIME_GROWTH_COLONY, toLevel - 1) * (traitOf(p).time ?? 1);
}

export type BuildBlock = 'busy' | 'max' | 'level' | 'res' | 'slot' | 'empty' | null;

/** Was ein Bau auf Platz `slot` kosten würde und ob er möglich ist */
export function buildPlan(s: GameState, p: number, slot: number, id?: string): { id: string; to: number; cost: ResMap; time: number; block: BuildBlock } | null {
  const c = s.colonies[String(p)];
  if (!c || slot < 0 || slot >= c.slots.length) return null;
  const cur = c.slots[slot];
  const bid = cur?.id ?? id;
  if (!bid || !COLONY_BUILDING_INDEX[bid]) return null;
  const to = (cur?.level ?? 0) + 1;
  const cost = buildCost(bid, to);
  const time = buildTime(p, bid, to);
  let block: BuildBlock = null;
  if (c.build) block = 'busy';
  else if (to > BUILDING_MAX) block = 'max';
  else if (COLONY_BUILDING_INDEX[bid].colonyLevel > c.level) block = 'level';
  else if (!hasResources(s, cost)) block = 'res';
  return { id: bid, to, cost, time, block };
}

export function startBuild(s: GameState, p: number, slot: number, id: string | undefined, now: number): boolean {
  const plan = buildPlan(s, p, slot, id);
  if (!plan || plan.block) return false;
  const c = s.colonies[String(p)];
  payResources(s, plan.cost);
  c.build = { slot, id: plan.id, to: plan.to, end: now + plan.time * 1000 };
  emit('structure', {});
  return true;
}

export type ColonyBuilt = GameEvents['colonyBuilt'];
export type MegaDone = GameEvents['megaDone'];

/** Fertige Bauten übernehmen. Mit `log` werden die Meldungen gesammelt statt gesendet (offline). */
export function updateColonyBuilds(s: GameState, now: number, log?: ColonyBuilt[]): number {
  let n = 0;
  for (const k in s.colonies) {
    const c = s.colonies[k];
    if (c.build && c.build.end <= now) {
      const b = c.build;
      c.slots[b.slot] = { id: b.id, level: b.to };
      c.build = null;
      s.stats.colonyBuilds++;
      n++;
      report(log, { planet: Number(k), id: b.id, level: b.to });
    }
    if (c.grow && c.grow <= now) {
      c.grow = 0;
      c.level = Math.min(COLONY_LEVEL_MAX, c.level + 1);
      s.stats.colonyBuilds++;
      n++;
      report(log, { planet: Number(k), id: '', level: c.level });
    }
  }
  if (n) {
    ensureColonies(s);
    emit('structure', {});
  }
  return n;
}

/** Kann in Kolonie p gerade gebaut werden (kein Bau läuft, genug Rohstoffe für etwas)? */
export function colonyCanBuild(s: GameState, p: number): boolean {
  const c = s.colonies[String(p)];
  if (!c || c.build) return false;
  for (let i = 0; i < c.slots.length; i++) {
    const plan = buildPlan(s, p, i, c.slots[i] ? undefined : 'mine');
    if (plan && !plan.block) return true;
  }
  return false;
}

function report(log: ColonyBuilt[] | undefined, e: ColonyBuilt): void {
  if (log) log.push(e);
  else emit('colonyBuilt', e);
}

/** Gebäude abreißen (keine Rückerstattung) */
export function demolish(s: GameState, p: number, slot: number): boolean {
  const c = s.colonies[String(p)];
  if (!c || !c.slots[slot] || c.build?.slot === slot) return false;
  c.slots[slot] = null;
  emit('structure', {});
  return true;
}

export function growPlan(s: GameState, p: number): { cost: ResMap; time: number; block: BuildBlock } | null {
  const c = s.colonies[String(p)];
  if (!c) return null;
  const cost = colonyLevelCost(c.level);
  const time = colonyLevelTime(c.level) * (traitOf(p).time ?? 1);
  let block: BuildBlock = null;
  if (c.grow) block = 'busy';
  else if (c.level >= COLONY_LEVEL_MAX) block = 'max';
  // Ausbau bringt einen neuen Bauplatz – erst die vorhandenen nutzen
  else if (c.slots.some((b) => !b)) block = 'empty';
  else if (!hasResources(s, cost)) block = 'res';
  return { cost, time, block };
}

export function startGrow(s: GameState, p: number, now: number): boolean {
  const plan = growPlan(s, p);
  if (!plan || plan.block) return false;
  payResources(s, plan.cost);
  s.colonies[String(p)].grow = now + plan.time * 1000;
  emit('structure', {});
  return true;
}

/** Fähigkeit „Sofortbau“: der Kolonie-Bau mit der längsten Restzeit ist sofort fertig */
export function finishColonyBuild(s: GameState, now: number): boolean {
  let best: ColonyState | null = null;
  for (const k in s.colonies) {
    const c = s.colonies[k];
    if (c.build && c.build.end > now && (!best || c.build.end > best.build!.end)) best = c;
  }
  if (!best) return false;
  best.build!.end = now;
  return true;
}

// ---- Megaprojekte -------------------------------------------------------------------

export function megaCostFor(s: GameState, id: string, stage: number): { res: ResMap; em: number } {
  const def = MEGA_INDEX[id];
  const k = Math.pow(MEGA_COST_GROWTH, stage - 1) * talentBonus(s).megaCost;
  const res: ResMap = {};
  for (const r of RES_IDS) if (def.cost[r]) res[r] = Math.round((def.cost[r] ?? 0) * k);
  return { res, em: Math.round((def.cost.em ?? 0) * k * emScale(s)) };
}

export function megaTime(stage: number): number {
  return (MEGA_HOURS[stage - 1] ?? 24) * 3600;
}

export type MegaBlock = 'busy' | 'max' | 'res' | null;

export function megaBlock(s: GameState, id: string): MegaBlock {
  const stage = megaStage(s, id) + 1;
  if (s.mega.build) return 'busy';
  if (stage > MEGA_STAGES) return 'max';
  const c = megaCostFor(s, id, stage);
  if (!hasResources(s, c.res) || s.fleet.em < c.em) return 'res';
  return null;
}

export function startMega(s: GameState, id: string, now: number): boolean {
  if (!MEGA_INDEX[id] || megaBlock(s, id)) return false;
  const stage = megaStage(s, id) + 1;
  const c = megaCostFor(s, id, stage);
  payResources(s, c.res);
  s.fleet.em -= c.em;
  s.mega.build = { id, stage, end: now + megaTime(stage) * 1000 };
  emit('structure', {});
  return true;
}

export function updateMega(s: GameState, now: number, log?: MegaDone[]): boolean {
  const b = s.mega.build;
  if (!b || b.end > now) return false;
  s.mega.stages[b.id] = Math.max(megaStage(s, b.id), b.stage);
  s.mega.build = null;
  s.stats.megaStages++;
  ensureColonies(s);
  if (log) log.push({ id: b.id, stage: b.stage });
  else emit('megaDone', { id: b.id, stage: b.stage });
  emit('structure', {});
  return true;
}

export function megaprojectsUnlocked(s: GameState): boolean {
  return coloniesUnlocked(s) && reachedPlanet(s) >= MEGA_UNLOCK_PLANET;
}

/** alle Megaprojekte durchgebaut? */
export function megaDoneCount(s: GameState): number {
  return MEGAPROJECTS.reduce((n, m) => n + megaStage(s, m.id), 0);
}

// ---- Börse ---------------------------------------------------------------------------

/** ⚗️ für 5.000 eines Grundstoffs (wächst mit Börsen-Stufe und Fortschritt) */
export function exchangeRate(s: GameState): number {
  const st = megaStage(s, 'boerse');
  if (st <= 0) return 0;
  return Math.round(20 * (1 + 0.5 * Math.min(3, st - 1)) * emScale(s));
}

export const EXCHANGE_LOT = 5000;

export function exchange(s: GameState, res: ResId): boolean {
  const rate = exchangeRate(s);
  if (!rate || !['metal', 'crystal', 'deut'].includes(res) || s.res[res] < EXCHANGE_LOT) return false;
  s.res[res] -= EXCHANGE_LOT;
  s.fleet.em += rate;
  s.fleet.emEarned += rate;
  emit('structure', {});
  return true;
}

export function dividendReady(s: GameState, day: string): boolean {
  return megaStage(s, 'boerse') >= MEGA_STAGES && s.mega.dividend !== day;
}

export function claimDividend(s: GameState, day: string): number {
  if (!dividendReady(s, day)) return 0;
  s.mega.dividend = day;
  s.gems += 50;
  s.stats.gemsEarned += 50;
  emit('structure', {});
  return 50;
}

export interface ColonySim {
  /** Rohstoffe vor der Simulation */
  before: Resources;
  built: ColonyBuilt[];
  mega: MegaDone[];
}

/** Offline: Produktion in Abschnitten, damit fertige Bauten schon mitproduzieren */
export function simulateColonies(s: GameState, seconds: number, now: number): ColonySim {
  const out: ColonySim = { before: { ...s.res }, built: [], mega: [] };
  if (!coloniesUnlocked(s) || !(seconds > 0)) return out;
  const chunks = Math.min(24, Math.max(1, Math.ceil(seconds / 1800)));
  const dt = seconds / chunks;
  const t0 = now - seconds * 1000;
  for (let i = 0; i < chunks; i++) {
    const t = t0 + i * dt * 1000;
    updateColonyBuilds(s, t, out.built);
    updateMega(s, t, out.mega);
    tickColonies(s, dt);
  }
  updateColonyBuilds(s, now, out.built);
  updateMega(s, now, out.mega);
  return out;
}

export { COLONY_BUILDINGS };
