import { fmt } from '../core/format';

export interface QuantumPerk {
  id: string;
  name: string;
  emoji: string;
  maxLevel: number;
  cost: (lvl: number) => number;
  effect: (lvl: number) => string;
  desc: string;
}

export const QUANTUM_PERKS: QuantumPerk[] = [
  {
    id: 'qincome', name: 'Quantenfeld', emoji: '🌀', maxLevel: 40,
    cost: (l) => Math.ceil(2 * Math.pow(2, l)), effect: (l) => `Einkommen ×${fmt(Math.pow(3, l))}`,
    desc: 'Verdreifacht dein Einkommen pro Stufe.',
  },
  {
    id: 'qdust', name: 'Sternenschmiede', emoji: '✨', maxLevel: 20,
    cost: (l) => Math.ceil(3 * Math.pow(2, l)), effect: (l) => `Sternenstaub ×${fmt(Math.pow(1.5, l))}`,
    desc: 'Mehr Sternenstaub aus jeder Supernova (×1,5 pro Stufe).',
  },
  {
    id: 'qlab', name: 'Labor-Erbe', emoji: '🧬', maxLevel: 5,
    cost: (l) => 3 + l * 3, effect: (l) => `${l * 10} % der Labor-Stufen bleiben`,
    desc: 'Ein Teil deiner Labor-Forschung übersteht den Galaxie-Sprung.',
  },
  {
    id: 'qstart', name: 'Hyperraum-Route', emoji: '🗺️', maxLevel: 3,
    cost: (l) => 4 + l * 4, effect: (l) => (l ? `Start auf Planet ${l + 1}` : 'Start im Erdorbit'),
    desc: 'Nach dem Galaxie-Sprung startest du direkt auf einem späteren Planeten.',
  },
  {
    id: 'qauto', name: 'Auto-Supernova', emoji: '♻️', maxLevel: 1,
    cost: () => 5, effect: (l) => (l ? 'Automatisch, sobald sich der Sternenstaub verdoppelt' : 'Aus'),
    desc: 'Löst automatisch eine Supernova aus, wenn sie deinen Sternenstaub mindestens verdoppelt. In den Einstellungen abschaltbar.',
  },
  {
    id: 'qgems', name: 'Kristall-Resonanz', emoji: '🔮', maxLevel: 4,
    cost: (l) => 3 + l * 2, effect: (l) => `+${l * 50} % Kristalle`,
    desc: 'Mehr Kristalle aus allen Quellen.',
  },
];

export const QUANTUM_INDEX: Record<string, QuantumPerk> = Object.fromEntries(QUANTUM_PERKS.map((p) => [p.id, p]));
