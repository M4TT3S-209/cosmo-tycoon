export interface BuildingDef {
  id: number;
  name: string;
  emoji: string;
  color: string; // Neon-Akzentfarbe
  baseCost: number;
  costMult: number;
  baseRevenue: number;
  baseTime: number; // Sekunden pro Zyklus
  upgradeNoun: string; // für Upgrade-Namen
  flavor: string;
}

/**
 * Alle Anlagen werden pro Stufe gleich schnell teurer. So ist eine bessere Anlage auf jeder Stufe
 * teurer als eine schwächere (bis v2.0 waren es 1,07–1,15 wie bei AdVenture Capitalist).
 */
export const COST_GROWTH = 1.09;

export const BUILDINGS: BuildingDef[] = [
  {
    id: 0, name: 'Schrottsammler', emoji: '🪨', color: '#9aa7b8',
    baseCost: 4, costMult: COST_GROWTH, baseRevenue: 1, baseTime: 1,
    upgradeNoun: 'Greifarme', flavor: 'Weltraumschrott ist auch nur Rohstoff.',
  },
  {
    id: 1, name: 'Asteroiden-Bohrer', emoji: '⛏️', color: '#ffb347',
    baseCost: 60, costMult: COST_GROWTH, baseRevenue: 60, baseTime: 3,
    upgradeNoun: 'Bohrköpfe', flavor: 'Bohrt sich durch Gestein und Gewinne.',
  },
  {
    id: 2, name: 'Satelliten-Netz', emoji: '🛰️', color: '#5ad1ff',
    baseCost: 720, costMult: COST_GROWTH, baseRevenue: 540, baseTime: 6,
    upgradeNoun: 'Antennen', flavor: 'Weltraum-WLAN – gegen Gebühr.',
  },
  {
    id: 3, name: 'Orbital-Solarfarm', emoji: '☀️', color: '#ffe066',
    baseCost: 8640, costMult: COST_GROWTH, baseRevenue: 4320, baseTime: 12,
    upgradeNoun: 'Solarzellen', flavor: 'Hier oben gibt es keine Wolken.',
  },
  {
    id: 4, name: 'Plasma-Raffinerie', emoji: '🧪', color: '#b07cff',
    baseCost: 103680, costMult: COST_GROWTH, baseRevenue: 51840, baseTime: 24,
    upgradeNoun: 'Reaktoren', flavor: 'Verwandelt Gas in glühendes Gold.',
  },
  {
    id: 5, name: 'Raketenwerft', emoji: '🚀', color: '#ff6b6b',
    baseCost: 1244160, costMult: COST_GROWTH, baseRevenue: 440000, baseTime: 48,
    upgradeNoun: 'Triebwerke', flavor: 'Jede Rakete ein Bestseller.',
  },
  {
    id: 6, name: 'Mondbasis', emoji: '🌕', color: '#e8e4d8',
    baseCost: 14929920, costMult: COST_GROWTH, baseRevenue: 3732480, baseTime: 96,
    upgradeNoun: 'Habitate', flavor: 'Helium-3 für das ganze Sonnensystem.',
  },
  {
    id: 7, name: 'Alien-Handelsposten', emoji: '👽', color: '#7dff7a',
    baseCost: 179159040, costMult: COST_GROWTH, baseRevenue: 31670000, baseTime: 192,
    upgradeNoun: 'Handelsrouten', flavor: 'Die Grünen zahlen in Antimaterie.',
  },
  {
    id: 8, name: 'Dyson-Sphäre', emoji: '🌌', color: '#ff7ad9',
    baseCost: 2149908480, costMult: COST_GROWTH, baseRevenue: 268738560, baseTime: 384,
    upgradeNoun: 'Spiegel', flavor: 'Eine ganze Sonne als Kraftwerk.',
  },
  {
    id: 9, name: 'Schwarzes-Loch-Reaktor', emoji: '🕳️', color: '#8a7dff',
    baseCost: 25798901760, costMult: COST_GROWTH, baseRevenue: 4282000000, baseTime: 768,
    upgradeNoun: 'Ereignishorizonte', flavor: 'Was hineinfällt, wird zu Profit.',
  },
];

export const BUILDING_COUNT = BUILDINGS.length;

/** Meilensteine pro Anlage: Tempo ×2 */
export const MILESTONES = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 4500, 5000];

/** Imperium-Meilensteine: wenn ALLE Anlagen mindestens so viele besitzen → Ertrag ×2 */
export const EMPIRE_MILESTONES = [25, 50, 100, 200, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000];
