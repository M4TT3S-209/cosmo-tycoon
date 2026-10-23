import { BUILDING_COUNT } from '../data/buildings';
import type { Notation } from './format';

export const SAVE_VERSION = 1;

export interface BuildingState {
  owned: number;
  /** 0..1 Fortschritt des laufenden Zyklus */
  progress: number;
  /** läuft ein manuell gestarteter Zyklus? */
  running: boolean;
}

export type BoostKind = 'income' | 'speed';
export interface Boost {
  id: string;
  kind: BoostKind;
  mult: number;
  /** Ende als Wanduhr-Zeit (ms) */
  until: number;
  label: string;
  icon: string;
}

export type QuestType = 'buy' | 'earn' | 'comet' | 'upgrade' | 'tap' | 'milestone' | 'manager';
export interface Quest {
  id: number;
  type: QuestType;
  /** Anlagen-Index oder -1 */
  target: number;
  /** Zielwert (relativ zum Startwert base) */
  goal: number;
  base: number;
  reward: number;
  done: boolean;
}

/** 0 = bis zum nächsten Meilenstein, -1 = Max */
export type BuyMode = 1 | 10 | 100 | 0 | -1;

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  notation: Notation;
  autoBuy: boolean;
  autoUpgrade: boolean;
  autoSupernova: boolean;
  buyMode: BuyMode;
}

export interface Stats {
  taps: number;
  cometsTapped: number;
  buildingsBought: number;
  boughtBy: number[];
  upgradesBought: number;
  managersHired: number;
  playTime: number;
  bestIncome: number;
  bestRunEarnings: number;
  gemsEarned: number;
  questsDone: number;
  timeWarps: number;
  fastestSupernova: number;
  daysPlayed: number;
  lastDay: string;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** Wanduhr-Zeitpunkt der letzten Aktivität (für Offline-Berechnung) */
  lastActive: number;

  cash: number;
  runEarnings: number;
  totalEarnings: number;
  runTime: number;

  gems: number;
  buildings: BuildingState[];
  managers: boolean[];
  upgrades: Record<string, boolean>;

  stardust: number;
  stardustEarned: number;
  stardustLifetime: number;
  lab: Record<string, number>;
  planet: number;
  supernovas: number;
  totalSupernovas: number;

  quantum: number;
  quantumEarned: number;
  qperks: Record<string, number>;
  galaxyJumps: number;

  gemPerm: number;
  boosts: Boost[];
  nextCometIn: number;

  achievements: Record<string, boolean>;
  quests: Quest[];
  questSeq: number;
  daily: { last: string; streak: number };

  stats: Stats;
  settings: Settings;
  tutorial: { step: number; flags: Record<string, boolean> };
  installHintDismissed: boolean;
}

export function defaultState(now = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastActive: now,
    cash: 4,
    runEarnings: 0,
    totalEarnings: 0,
    runTime: 0,
    gems: 10,
    buildings: Array.from({ length: BUILDING_COUNT }, (_, i) => ({ owned: i === 0 ? 1 : 0, progress: 0, running: false })),
    managers: Array(BUILDING_COUNT).fill(false),
    upgrades: {},
    stardust: 0,
    stardustEarned: 0,
    stardustLifetime: 0,
    lab: {},
    planet: 0,
    supernovas: 0,
    totalSupernovas: 0,
    quantum: 0,
    quantumEarned: 0,
    qperks: {},
    galaxyJumps: 0,
    gemPerm: 0,
    boosts: [],
    nextCometIn: 90,
    achievements: {},
    quests: [],
    questSeq: 0,
    daily: { last: '', streak: 0 },
    stats: {
      taps: 0,
      cometsTapped: 0,
      buildingsBought: 0,
      boughtBy: Array(BUILDING_COUNT).fill(0),
      upgradesBought: 0,
      managersHired: 0,
      playTime: 0,
      bestIncome: 0,
      bestRunEarnings: 0,
      gemsEarned: 0,
      questsDone: 0,
      timeWarps: 0,
      fastestSupernova: 0,
      daysPlayed: 0,
      lastDay: '',
    },
    settings: {
      sound: true,
      music: true,
      haptics: true,
      notation: 'short',
      autoBuy: true,
      autoUpgrade: true,
      autoSupernova: true,
      buyMode: 1,
    },
    tutorial: { step: 0, flags: {} },
    installHintDismissed: false,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Füllt fehlende Felder eines geladenen Spielstands mit Standardwerten auf. */
function merge(def: unknown, loaded: unknown): unknown {
  if (loaded === undefined || loaded === null) return def;
  if (Array.isArray(def)) {
    if (!Array.isArray(loaded)) return def;
    // Arrays fester Länge (Anlagen, Manager) auffüllen; freie Arrays übernehmen
    if (def.length > 0) {
      return def.map((d, i) => merge(d, loaded[i]));
    }
    return loaded;
  }
  if (isObj(def)) {
    if (!isObj(loaded)) return def;
    const out: Record<string, unknown> = { ...loaded };
    for (const k of Object.keys(def)) out[k] = merge(def[k], loaded[k]);
    return out;
  }
  if (typeof def === 'number') return typeof loaded === 'number' && Number.isFinite(loaded) ? loaded : def;
  if (typeof def !== typeof loaded) return def;
  return loaded;
}

/** Migration + Validierung eines geladenen Objekts */
export function hydrate(raw: unknown, now = Date.now()): GameState {
  if (!isObj(raw) || typeof raw.version !== 'number') throw new Error('Ungültiger Spielstand');
  const def = defaultState(now);
  // Freie Records (upgrades, lab, …) haben leere Defaults → werden übernommen
  const s = merge(def, raw) as GameState;
  s.version = SAVE_VERSION;
  return s;
}
