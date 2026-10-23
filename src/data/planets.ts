export interface PlanetDef {
  name: string;
  emoji: string;
  /** benötigter Sternenstaub (insgesamt verdient seit dem letzten Galaxie-Sprung) */
  need: number;
  /** Kugel-Farben: Licht, Mitte, Schatten */
  sphere: [string, string, string];
  ring?: string;
  glow: string;
  /** Nebel-Farben im Hintergrund */
  nebula: [string, string];
  desc: string;
  /** Bonus, solange du auf diesem Planeten bist */
  trait?: PlanetTrait;
}

export interface PlanetTrait {
  text: string;
  /** Anlagen-Index → Ertrags-Multiplikator */
  bld?: Record<number, number>;
  /** Kometen häufiger (+Anteil) */
  comet?: number;
  /** Offline-Effizienz (+Anteil) */
  offline?: number;
  /** Expeditionen schneller (Anteil) */
  expSpeed?: number;
}

export const PLANET_MULT = 1.5;

export const PLANETS: PlanetDef[] = [
  { name: 'Erdorbit', emoji: '🌍', need: 0, sphere: ['#9be7ff', '#2f7de1', '#0b2a63'], glow: '#4aa8ff', nebula: ['#1b2f7a', '#3a1a6b'], desc: 'Hier fängt alles an.' },
  { name: 'Mond', emoji: '🌕', need: 10, sphere: ['#f4f1e8', '#b9b4a6', '#4a463d'], glow: '#d8d2c0', nebula: ['#2a2f45', '#3b2f55'], desc: 'Grau, staubig, profitabel.' , trait: { text: 'Mondbasis ×3', bld: { 6: 3 } } },
  { name: 'Mars', emoji: '🔴', need: 60, sphere: ['#ffb08a', '#d2522a', '#4d150b'], glow: '#ff6a3d', nebula: ['#5a1a1a', '#3a1a4b'], desc: 'Rote Erde, goldene Zukunft.' , trait: { text: 'Asteroiden-Bohrer ×3', bld: { 1: 3 } } },
  { name: 'Asteroidengürtel', emoji: '☄️', need: 300, sphere: ['#d9c7a3', '#8a7456', '#2e2418'], ring: '#a08b6a', glow: '#c9a86a', nebula: ['#3d2f1a', '#1a2a3d'], desc: 'Ein Paradies für Bohrer.' , trait: { text: 'Schrottsammler & Bohrer ×2, Kometen +30 %', bld: { 0: 2, 1: 2 }, comet: 0.3 } },
  { name: 'Jupiter', emoji: '🟠', need: 1500, sphere: ['#ffe3b3', '#d98c4a', '#5c2e14'], glow: '#ffa95c', nebula: ['#5a3315', '#2a1a4b'], desc: 'Ein Sturm aus Credits.' , trait: { text: 'Plasma-Raffinerie ×3', bld: { 4: 3 } } },
  { name: 'Saturn', emoji: '🪐', need: 8000, sphere: ['#fff0c2', '#d9b46a', '#5a4220'], ring: '#f0d58c', glow: '#ffd77a', nebula: ['#4b3a14', '#1a3a4b'], desc: 'Die Ringe sind aus purem Gold. Fast.' , trait: { text: 'Satelliten-Netz ×3', bld: { 2: 3 } } },
  { name: 'Neptun', emoji: '🔵', need: 4e4, sphere: ['#a8d8ff', '#2e5fe0', '#0a1a5c'], glow: '#4a7dff', nebula: ['#0f2a6b', '#2a0f5c'], desc: 'Eisige Winde, heiße Deals.' , trait: { text: 'Offline-Ertrag +25 %', offline: 0.25 } },
  { name: 'Alpha Centauri', emoji: '⭐', need: 4e5, sphere: ['#fffbe0', '#ffd23f', '#d9480f'], glow: '#ffcc33', nebula: ['#5c3a0a', '#5c0a3a'], desc: 'Drei Sonnen, dreifacher Profit.' , trait: { text: 'Orbital-Solarfarm ×4', bld: { 3: 4 } } },
  { name: 'Andromeda', emoji: '🌌', need: 3e6, sphere: ['#ffd6f5', '#b44ad9', '#2a0a4b'], ring: '#e08cff', glow: '#d06aff', nebula: ['#4b0a5c', '#0a2a5c'], desc: 'Eine neue Galaxie wartet.' , trait: { text: 'Alien-Handelsposten ×3, Expeditionen 25 % schneller', bld: { 7: 3 }, expSpeed: 0.25 } },
  { name: 'Galaxiekern', emoji: '🕳️', need: 2e7, sphere: ['#ffffff', '#ffb36b', '#1a0a00'], ring: '#ff8a3d', glow: '#ffae5c', nebula: ['#5c2a0a', '#0a0a2a'], desc: 'Das Zentrum von allem. Der Quantensprung wartet.' , trait: { text: 'Schwarzes-Loch-Reaktor ×5', bld: { 9: 5 } } },
];
