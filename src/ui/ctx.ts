// Gemeinsamer Laufzeit-Kontext der Oberfläche
import { newCalc, type Calc } from '../core/economy';
import { defaultState, type GameState } from '../core/state';
import { newTickOut, type TickOut } from '../core/tick';

export type TabId = 'anlagen' | 'manager' | 'upgrades' | 'kosmos' | 'mehr';

export const G: {
  s: GameState;
  calc: Calc;
  out: TickOut;
  now: number;
  debug: boolean;
  /** Struktur geändert → Listen neu aufbauen */
  dirty: boolean;
  tab: TabId;
  sub: Record<TabId, string>;
} = {
  s: defaultState(),
  calc: newCalc(),
  out: newTickOut(),
  now: Date.now(),
  debug: false,
  dirty: true,
  tab: 'anlagen',
  sub: { anlagen: '', manager: '', upgrades: '', kosmos: 'nova', mehr: 'missionen' },
};

type TabListener = (tab: TabId) => void;
const tabListeners: TabListener[] = [];
export function onTabChange(fn: TabListener): void {
  tabListeners.push(fn);
}
export function openTab(tab: TabId, sub?: string): void {
  if (sub) G.sub[tab] = sub;
  G.tab = tab;
  G.dirty = true;
  for (const fn of tabListeners) fn(tab);
}

export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone =
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
