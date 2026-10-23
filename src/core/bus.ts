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
}

export type CometKind = 'cash' | 'frenzy' | 'speed' | 'gems';

type Handler<T> = (payload: T) => void;
const handlers = new Map<keyof GameEvents, Handler<never>[]>();

export function on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): void {
  let list = handlers.get(type);
  if (!list) handlers.set(type, (list = []));
  list.push(fn as Handler<never>);
}

export function emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
  const list = handlers.get(type) as Handler<GameEvents[K]>[] | undefined;
  if (!list) return;
  for (const fn of list) fn(payload);
}
