import { BUILDINGS } from './buildings';
import { roman } from '../core/format';

export interface UpgradeDef {
  id: string;
  name: string;
  /** Ziel-Anlage oder -1 für alle */
  target: number;
  mult: number;
  cost: number;
}

const PREFIXES = [
  'Titan-', 'Turbo-', 'Quanten-', 'Plasma-', 'Fusions-', 'Antimaterie-',
  'Hyper-', 'Nano-', 'Gravitons-', 'Tachyonen-', 'Neutronen-', 'Omega-',
];

// Jede Runde: 10 Anlagen-Upgrades (×3) und ein Imperium-Upgrade (×3 auf alles)
export const UPGRADE_ROUNDS = PREFIXES.length;
const FIRST_BASE = 2.5e5;
const ROUND_STEP = 1e7; // Faktor zwischen Runden
const IN_ROUND_STEP = 3.2; // Faktor zwischen Anlagen innerhalb einer Runde

function build(): UpgradeDef[] {
  const list: UpgradeDef[] = [];
  for (let r = 0; r < UPGRADE_ROUNDS; r++) {
    const base = FIRST_BASE * Math.pow(ROUND_STEP, r);
    for (let b = 0; b < BUILDINGS.length; b++) {
      list.push({
        id: `u${r}_${b}`,
        name: PREFIXES[r] + BUILDINGS[b].upgradeNoun,
        target: b,
        mult: 3,
        cost: base * Math.pow(IN_ROUND_STEP, b),
      });
    }
    list.push({
      id: `u${r}_all`,
      name: 'Imperium-Protokoll ' + roman(r + 1),
      target: -1,
      mult: 3,
      cost: base * Math.pow(IN_ROUND_STEP, BUILDINGS.length) * 2,
    });
  }
  return list.sort((a, b) => a.cost - b.cost);
}

export const UPGRADES: UpgradeDef[] = build();
export const UPGRADE_INDEX: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
