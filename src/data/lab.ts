import { fmt } from '../core/format';

export type LabBranch = 'Wirtschaft' | 'Kometen' | 'Automatik' | 'Zeit';

export interface LabNode {
  id: string;
  name: string;
  emoji: string;
  branch: LabBranch;
  maxLevel: number;
  requires?: string;
  /** Kosten in ✨ für die nächste Stufe (aktuelle Stufe = lvl) */
  cost: (lvl: number) => number;
  /** Effekt-Beschreibung für eine Stufe */
  effect: (lvl: number) => string;
  desc: string;
}

const geo = (base: number, mult: number) => (lvl: number) => Math.ceil(base * Math.pow(mult, lvl));

const START_CASH_TABLE = [0, 1e3, 5e4, 1e6, 5e7, 1e9, 5e10, 1e12, 1e14];
export const START_CASH = (lvl: number) => START_CASH_TABLE[Math.max(0, Math.min(START_CASH_TABLE.length - 1, lvl))];

export const LAB_NODES: LabNode[] = [
  // Wirtschaft
  {
    id: 'income', name: 'Kosmische Effizienz', emoji: '📈', branch: 'Wirtschaft', maxLevel: 60,
    cost: geo(5, 8), effect: (l) => `Einkommen ×${fmt(Math.pow(2, l))}`,
    desc: 'Verdoppelt dein gesamtes Einkommen pro Stufe.',
  },
  {
    id: 'startcash', name: 'Startkapital', emoji: '💰', branch: 'Wirtschaft', maxLevel: 8, requires: 'income',
    cost: geo(5, 4), effect: (l) => (l ? `Start mit ${fmt(START_CASH(l))} 🪙` : 'Kein Startkapital'),
    desc: 'Beginne jede Supernova mit einem Batzen Geld.',
  },
  {
    id: 'discount', name: 'Bau-Rabatt', emoji: '🏷️', branch: 'Wirtschaft', maxLevel: 10, requires: 'income',
    cost: geo(10, 3.5), effect: (l) => `Anlagen −${Math.round((1 - Math.pow(0.95, l)) * 100)} % Kosten`,
    desc: 'Alle Anlagen werden günstiger.',
  },
  {
    id: 'milestone', name: 'Meilenstein-Boost', emoji: '🏆', branch: 'Wirtschaft', maxLevel: 4, requires: 'discount',
    cost: geo(40, 8), effect: (l) => `Imperium-Meilensteine ×${String(2 + l * 0.25).replace('.', ',')}`,
    desc: 'Imperium-Meilensteine geben mehr Ertrag.',
  },
  {
    id: 'snboost', name: 'Supernova-Verstärker', emoji: '💥', branch: 'Wirtschaft', maxLevel: 25, requires: 'startcash',
    cost: geo(15, 4), effect: (l) => `+${l * 15} % Sternenstaub`,
    desc: 'Mehr Sternenstaub bei jeder Supernova.',
  },
  // Zeit
  {
    id: 'warp', name: 'Warp-Antrieb', emoji: '⚡', branch: 'Zeit', maxLevel: 20,
    cost: geo(4, 2.5), effect: (l) => `Zyklen +${l * 25} % schneller`,
    desc: 'Alle Anlagen produzieren schneller.',
  },
  {
    id: 'offtime', name: 'Offline-Speicher', emoji: '🔋', branch: 'Zeit', maxLevel: 11, requires: 'warp',
    cost: geo(4, 1.8), effect: (l) => `Offline bis ${2 + l * 2} h`,
    desc: 'Deine Manager arbeiten länger, während du weg bist.',
  },
  {
    id: 'offeff', name: 'Offline-Effizienz', emoji: '🌙', branch: 'Zeit', maxLevel: 5, requires: 'offtime',
    cost: geo(8, 2.5), effect: (l) => `${50 + l * 10} % Offline-Ertrag`,
    desc: 'Offline verdienst du einen größeren Anteil.',
  },
  {
    id: 'boostlen', name: 'Zeitdehnung', emoji: '⏳', branch: 'Zeit', maxLevel: 8, requires: 'warp',
    cost: geo(10, 2.2), effect: (l) => `Boosts +${l * 25} % länger`,
    desc: 'Boosts und Kometen-Effekte halten länger.',
  },
  // Kometen
  {
    id: 'magnet', name: 'Kometen-Magnet', emoji: '🧲', branch: 'Kometen', maxLevel: 10,
    cost: geo(4, 2), effect: (l) => `Kometen ${l * 15} % häufiger`,
    desc: 'Goldene Kometen erscheinen öfter.',
  },
  {
    id: 'luck', name: 'Kometen-Glück', emoji: '🍀', branch: 'Kometen', maxLevel: 10, requires: 'magnet',
    cost: geo(6, 2.1), effect: (l) => `Kometen-Belohnung +${l * 50} %`,
    desc: 'Kometen bringen mehr Geld.',
  },
  {
    id: 'gemfinder', name: 'Kristall-Finder', emoji: '💎', branch: 'Kometen', maxLevel: 5, requires: 'magnet',
    cost: geo(20, 3), effect: (l) => `+${l * 25} % Kristalle`,
    desc: 'Mehr Kristalle aus Missionen, Kometen und Erfolgen.',
  },
  // Automatik
  {
    id: 'keepmgr', name: 'Manager-Gedächtnis', emoji: '🧠', branch: 'Automatik', maxLevel: 1,
    cost: () => 20, effect: (l) => (l ? 'Manager bleiben' : 'Manager gehen verloren'),
    desc: 'Deine Manager bleiben nach einer Supernova bei dir.',
  },
  {
    id: 'quickstart', name: 'Schnellstart', emoji: '🏁', branch: 'Automatik', maxLevel: 10, requires: 'keepmgr',
    cost: geo(5, 1.9), effect: (l) => (l ? `Anlagen 1–${l} starten mit 10 Stück` : 'Kein Schnellstart'),
    desc: 'Starte jede Supernova mit fertigen Anlagen.',
  },
  {
    id: 'autobuy', name: 'Auto-Käufer', emoji: '🤖', branch: 'Automatik', maxLevel: 1, requires: 'keepmgr',
    cost: () => 60, effect: (l) => (l ? 'Kauft Anlagen automatisch' : 'Aus'),
    desc: 'Ein Roboter kauft automatisch die günstigsten Anlagen. In den Einstellungen abschaltbar.',
  },
  {
    id: 'autoupgrade', name: 'Auto-Upgrader', emoji: '🛠️', branch: 'Automatik', maxLevel: 1, requires: 'autobuy',
    cost: () => 150, effect: (l) => (l ? 'Kauft Upgrades & Manager' : 'Aus'),
    desc: 'Kauft automatisch Upgrades und Manager, sobald du sie dir leisten kannst.',
  },
];

export const LAB_INDEX: Record<string, LabNode> = Object.fromEntries(LAB_NODES.map((n) => [n.id, n]));
export const LAB_BRANCHES: LabBranch[] = ['Wirtschaft', 'Zeit', 'Kometen', 'Automatik'];
