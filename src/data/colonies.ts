// Kolonie-Gebäude und Planeten-Spezialitäten
import type { ResId } from '../core/state';

export interface ColonyBuildingDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** Produktion pro Stunde bei Stufe 1 */
  produce?: Partial<Record<ResId, number>>;
  /** Verbrauch pro Stunde bei Stufe 1 */
  consume?: Partial<Record<ResId, number>>;
  /** Energie bei Stufe 1: positiv = erzeugt, negativ = verbraucht */
  energy: number;
  /** zusätzliche Lager-Kapazität je Rohstoff bei Stufe 1 */
  storage?: number;
  /** Baukosten für Stufe 1 (jede Stufe ×1,6) */
  cost: Partial<Record<ResId, number>>;
  /** Bauzeit für Stufe 1 in Sekunden (jede Stufe ×1,5) */
  time: number;
  /** benötigte Kolonie-Stufe */
  colonyLevel: number;
}

export const RES_META: Record<ResId, { name: string; emoji: string }> = {
  metal: { name: 'Metall', emoji: '🔩' },
  crystal: { name: 'Kristall', emoji: '🔷' },
  deut: { name: 'Deuterium', emoji: '🛢️' },
  alloy: { name: 'Legierung', emoji: '🧱' },
  chips: { name: 'Quantenchips', emoji: '💾' },
};

/** Kolonien ab dem Mars (Planet-Index 2), Megaprojekte ab dem Jupiter (4) – neue Spieler bekommen nicht alles auf einmal */
export const COLONY_UNLOCK_PLANET = 2;
export const MEGA_UNLOCK_PLANET = 4;

export const BUILDING_MAX = 25;
export const COST_GROWTH_COLONY = 1.6;
export const TIME_GROWTH_COLONY = 1.5;
/** Wachstum von Produktion und Energie pro Stufe (zusätzlich zum linearen Anteil) */
export const PROD_GROWTH = 1.1;

export const COLONY_BUILDINGS: ColonyBuildingDef[] = [
  { id: 'mine', name: 'Mine', emoji: '⛏️', desc: 'Fördert Metall', produce: { metal: 60 }, energy: -2, cost: { metal: 60, crystal: 15 }, time: 45, colonyLevel: 1 },
  { id: 'kristall', name: 'Kristallbohrer', emoji: '💠', desc: 'Bohrt Kristall', produce: { crystal: 40 }, energy: -3, cost: { metal: 50, crystal: 25 }, time: 60, colonyLevel: 1 },
  { id: 'deut', name: 'Deuteriumpumpe', emoji: '🛢️', desc: 'Pumpt Deuterium', produce: { deut: 25 }, energy: -3, cost: { metal: 80, crystal: 40 }, time: 75, colonyLevel: 1 },
  { id: 'solar', name: 'Solarkraftwerk', emoji: '☀️', desc: 'Erzeugt Energie', energy: 7, cost: { metal: 70, crystal: 30 }, time: 45, colonyLevel: 1 },
  { id: 'fusion', name: 'Fusionsreaktor', emoji: '⚛️', desc: 'Viel Energie, verbraucht Deuterium', consume: { deut: 10 }, energy: 18, cost: { metal: 400, crystal: 250, deut: 100 }, time: 240, colonyLevel: 3 },
  { id: 'schmiede', name: 'Legierungsschmiede', emoji: '🧱', desc: 'Schmilzt Metall und Kristall zu Legierung', consume: { metal: 40, crystal: 20 }, produce: { alloy: 10 }, energy: -4, cost: { metal: 300, crystal: 150 }, time: 180, colonyLevel: 2 },
  { id: 'chips', name: 'Chipfabrik', emoji: '💾', desc: 'Fertigt Quantenchips aus Kristall und Deuterium', consume: { crystal: 25, deut: 12 }, produce: { chips: 6 }, energy: -6, cost: { metal: 400, crystal: 300, deut: 100 }, time: 300, colonyLevel: 3 },
  { id: 'lager', name: 'Lager', emoji: '📦', desc: 'Mehr Platz für alle Rohstoffe (gilt für alle Kolonien)', storage: 15000, energy: 0, cost: { metal: 200, crystal: 100 }, time: 150, colonyLevel: 1 },
];

export const COLONY_BUILDING_INDEX: Record<string, ColonyBuildingDef> = Object.fromEntries(COLONY_BUILDINGS.map((b) => [b.id, b]));

/** Ausbau der Kolonie selbst: mehr Bauplätze, +10 % Produktion je Stufe */
export const COLONY_LEVEL_MAX = 10;
/** Kosten für den Ausbau von Stufe `level` auf `level + 1` – Legierung erst ab Stufe 2 (Schmiede), Chips ab Stufe 3 */
export function colonyLevelCost(level: number): Partial<Record<ResId, number>> {
  const k = Math.pow(2.2, level - 1);
  const c: Partial<Record<ResId, number>> = { metal: Math.round(800 * k), crystal: Math.round(400 * k) };
  if (level >= 2) c.alloy = Math.round(150 * Math.pow(2.2, level - 2));
  if (level >= 3) c.chips = Math.round(60 * Math.pow(2.2, level - 3));
  return c;
}
export function colonyLevelTime(level: number): number {
  return 600 * Math.pow(1.6, level - 1);
}

export interface ColonyTrait {
  text: string;
  /** Produktions-Multiplikator je Rohstoff */
  prod?: Partial<Record<ResId, number>>;
  /** Multiplikator je Gebäude (Ausstoß und Energie) */
  building?: Record<string, number>;
  /** Multiplikator auf alles */
  all?: number;
  /** Bauzeit-Faktor */
  time?: number;
}

/** Spezialität je Planet-Index */
export const COLONY_TRAITS: ColonyTrait[] = [
  { text: 'Heimatwerft: Bauzeiten −25 %', time: 0.75 },
  { text: 'Metall ×1,5', prod: { metal: 1.5 } },
  { text: 'Metall ×2', prod: { metal: 2 } },
  { text: 'Metall und Kristall ×1,5', prod: { metal: 1.5, crystal: 1.5 } },
  { text: 'Deuterium ×2, Fusionsreaktoren ×1,25', prod: { deut: 2 }, building: { fusion: 1.25 } },
  { text: 'Kristall ×2', prod: { crystal: 2 } },
  { text: 'Deuterium ×2,5', prod: { deut: 2.5 } },
  { text: 'Drei Sonnen: Solarkraftwerke ×2', building: { solar: 2 } },
  { text: 'Chipfabriken ×2', building: { chips: 2 } },
  { text: 'Legierungsschmieden ×2, alles ×1,25', building: { schmiede: 2 }, all: 1.25 },
];
