import { BUILDING_COUNT } from '../data/buildings';
import type { Notation } from './format';

export const SAVE_VERSION = 3;

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

export interface ShipState {
  engine: number;
  cargo: number;
  shield: number;
}

export interface Mission {
  /** Hangar-Platz (Index in fleet.ships) */
  slot: number;
  dest: string;
  /** Wanduhr-Zeiten in ms */
  start: number;
  end: number;
}

export interface ArtifactState {
  level: number;
  shards: number;
}

// ---- Version 3: Kolonien, Kommandant, Funksprüche, Fraktionen -----------------

export interface ColonyBuilding {
  id: string;
  level: number;
}

export interface ColonyState {
  level: number;
  /** Bauplätze; null = frei */
  slots: (ColonyBuilding | null)[];
  /** laufender Bau auf einem Platz (Wanduhr-Ende in ms) */
  build: { slot: number; id: string; to: number; end: number } | null;
  /** Ausbau der Kolonie selbst: fertig um (ms), 0 = keiner */
  grow: number;
}

export interface Resources {
  metal: number;
  crystal: number;
  deut: number;
  alloy: number;
  chips: number;
}
export type ResId = keyof Resources;

export interface PendingEvent {
  id: string;
  /** eingetroffen um (ms) */
  at: number;
}

/** 0 = bis zum nächsten Meilenstein, -1 = Max */
export type BuyMode = 1 | 10 | 100 | 0 | -1;

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  /** Sounds auch bei aktivem Lautlos-Schalter (iOS) */
  ignoreMute: boolean;
  notation: Notation;
  autoBuy: boolean;
  autoUpgrade: boolean;
  autoSupernova: boolean;
  /** Auto-Labor (Quantenrechner Stufe 3) */
  autoLab: boolean;
  /** Kristall-Sammler holt fertige Missionen ab (wenn gekauft) */
  autoCollect: boolean;
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
  /** höchster je erreichter Planet (auch über Galaxie-Sprünge hinweg) */
  bestPlanet: number;
  challengesDone: number;
  eventsAnswered: number;
  abilitiesUsed: number;
  colonyBuilds: number;
  megaStages: number;
  weeklyDone: number;
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

  fleet: {
    ships: ShipState[];
    missions: Mission[];
    em: number;
    emEarned: number;
    expeditions: number;
    crates: number;
  };
  artifacts: Record<string, ArtifactState>;
  equipped: string[];
  challenge: { active: string; goal: number };
  challengeTiers: Record<string, number>;
  rank: { level: number; xp: number };

  /** Talente (id → Stufe), Fähigkeiten, Abklingzeiten (Wanduhr ms) */
  commander: {
    talents: Record<string, number>;
    bonusPoints: number;
    respecs: number;
    abilities: string[];
    cooldowns: Record<string, number>;
    /** Geistesblitz aktiv: nächste Supernova bringt mehr */
    insight: boolean;
  };
  /** Kolonien je Planet-Index */
  colonies: Record<string, ColonyState>;
  res: Resources;
  mega: {
    stages: Record<string, number>;
    build: { id: string; stage: number; end: number } | null;
    /** Tag der letzten Börsen-Dividende */
    dividend: string;
  };
  events: {
    queue: PendingEvent[];
    /** Sekunden aktiven Spiels bis zum nächsten Funkspruch */
    nextIn: number;
    /** wie oft schon erlebt */
    seen: Record<string, number>;
    /** Ketten: Folge-Ereignis-ID → frühestens ab (ms) */
    chains: Record<string, number>;
  };
  /** Ruf je Fraktion */
  factions: Record<string, number>;
  /** Fraktions-Shop: Käufe je Woche und Angebot */
  factionBuys: Record<string, number>;
  /** Wochen-Ereignis: Kalenderwoche, Zählerstand zu Wochenbeginn, Auftrag */
  weekly: { key: string; base: number; claimed: boolean; contract: string };

  stats: Stats;
  settings: Settings;
  tutorial: { step: number; flags: Record<string, boolean> };
  installHintDismissed: boolean;
  /** Kristall-Sammler im Shop gekauft (Version 3.1) */
  gemCollector: boolean;
  /** zuletzt gesehene App-Version (für den Update-Hinweis, seit 3.1.3) */
  seenVersion: string;
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
    // Listen ohne feste Länge immer mit leerem Standard: merge() übernimmt sie dann 1:1
    fleet: { ships: [], missions: [], em: 0, emEarned: 0, expeditions: 0, crates: 0 },
    artifacts: {},
    equipped: [],
    challenge: { active: '', goal: 0 },
    challengeTiers: {},
    rank: { level: 1, xp: 0 },
    commander: { talents: {}, bonusPoints: 0, respecs: 0, abilities: [], cooldowns: {}, insight: false },
    colonies: {},
    res: { metal: 0, crystal: 0, deut: 0, alloy: 0, chips: 0 },
    mega: { stages: {}, build: null, dividend: '' },
    events: { queue: [], nextIn: 600, seen: {}, chains: {} },
    factions: {},
    factionBuys: {},
    weekly: { key: '', base: 0, claimed: false, contract: '' },
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
      bestPlanet: 0,
      challengesDone: 0,
      eventsAnswered: 0,
      abilitiesUsed: 0,
      colonyBuilds: 0,
      megaStages: 0,
      weeklyDone: 0,
    },
    settings: {
      sound: true,
      music: true,
      haptics: true,
      ignoreMute: false,
      notation: 'short',
      autoBuy: true,
      autoUpgrade: true,
      autoSupernova: true,
      autoLab: true,
      autoCollect: true,
      buyMode: 1,
    },
    tutorial: { step: 0, flags: {} },
    installHintDismissed: false,
    gemCollector: false,
    seenVersion: '',
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

/** Version eines geladenen Rohobjekts (für Migrationen) */
export function rawVersion(raw: unknown): number {
  return isObj(raw) && typeof raw.version === 'number' ? raw.version : 0;
}

/** Validierung eines geladenen Objekts + Auffüllen fehlender Felder (Migrationen: core/migrate.ts) */
export function hydrate(raw: unknown, now = Date.now()): GameState {
  if (!isObj(raw) || typeof raw.version !== 'number') throw new Error('Ungültiger Spielstand');
  const def = defaultState(now);
  // Freie Records (upgrades, lab, …) haben leere Defaults → werden übernommen
  const s = merge(def, raw) as GameState;
  s.version = SAVE_VERSION;
  return s;
}
