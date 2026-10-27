// Kleiner typisierter Event-Bus zwischen Spiellogik und UI (DOM-frei)
import type { AchievementDef } from '../data/achievements';

export interface GameEvents {
  buy: { building: number; amount: number };
  milestone: { building: number; level: number };
  empire: { level: number; mult: number };
  upgrade: { id: string };
  manager: { building: number };
  lab: { id: string; level: number };
  quantum: { id: string; level: number };
  achievement: { def: AchievementDef };
  questDone: { id: number };
  supernova: { gain: number; planetChanged: boolean; planet: number };
  galaxy: { gain: number };
  boost: { label: string; icon: string };
  comet: { kind: CometKind; text: string };
  structure: Record<string, never>;
  cantAfford: Record<string, never>;
  timewarp: { amount: number; hours: number };
  rankUp: { level: number; gems: number };
  challengeDone: { id: string; tier: number };
  challengeFailed: { id: string };
  numberCap: Record<string, never>;
  talent: { id: string };
  ability: { id: string };
  cometShower: { n: number };
  eventArrived: { id: string };
  factionUp: { faction: string; level: number };
  /** Kolonie-Bau fertig (id leer = Kolonie-Stufe) */
  colonyBuilt: { planet: number; id: string; level: number };
  megaDone: { id: string; stage: number };
  weeklyNew: { key: string };
  /** Kristall-Sammler hat Missionen abgeholt */
  autoCollect: { gems: number; n: number };
}

export type CometKind = 'cash' | 'frenzy' | 'speed' | 'gems';

type Handler<T> = (payload: T) => void;
const handlers = new Map<keyof GameEvents, Handler<never>[]>();

export function on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): void {
  let list = handlers.get(type);
  if (!list) handlers.set(type, (list = []));
  list.push(fn as Handler<never>);
}

let muted = false;
/** Während der Offline-Simulation keine Toasts/Sounds auslösen */
export function muteEvents(on: boolean): void {
  muted = on;
}

export function emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
  if (muted) return;
  const list = handlers.get(type) as Handler<GameEvents[K]>[] | undefined;
  if (!list) return;
  for (const fn of list) fn(payload);
}
