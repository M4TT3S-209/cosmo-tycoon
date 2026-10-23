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
}

export const PLANET_MULT = 1.5;

export const PLANETS: PlanetDef[] = [
  { name: 'Erdorbit', emoji: '🌍', need: 0, sphere: ['#9be7ff', '#2f7de1', '#0b2a63'], glow: '#4aa8ff', nebula: ['#1b2f7a', '#3a1a6b'], desc: 'Hier fängt alles an.' },
  { name: 'Mond', emoji: '🌕', need: 10, sphere: ['#f4f1e8', '#b9b4a6', '#4a463d'], glow: '#d8d2c0', nebula: ['#2a2f45', '#3b2f55'], desc: 'Grau, staubig, profitabel.' },
  { name: 'Mars', emoji: '🔴', need: 60, sphere: ['#ffb08a', '#d2522a', '#4d150b'], glow: '#ff6a3d', nebula: ['#5a1a1a', '#3a1a4b'], desc: 'Rote Erde, goldene Zukunft.' },
  { name: 'Asteroidengürtel', emoji: '☄️', need: 300, sphere: ['#d9c7a3', '#8a7456', '#2e2418'], ring: '#a08b6a', glow: '#c9a86a', nebula: ['#3d2f1a', '#1a2a3d'], desc: 'Ein Paradies für Bohrer.' },
  { name: 'Jupiter', emoji: '🟠', need: 1500, sphere: ['#ffe3b3', '#d98c4a', '#5c2e14'], glow: '#ffa95c', nebula: ['#5a3315', '#2a1a4b'], desc: 'Ein Sturm aus Credits.' },
  { name: 'Saturn', emoji: '🪐', need: 8000, sphere: ['#fff0c2', '#d9b46a', '#5a4220'], ring: '#f0d58c', glow: '#ffd77a', nebula: ['#4b3a14', '#1a3a4b'], desc: 'Die Ringe sind aus purem Gold. Fast.' },
  { name: 'Neptun', emoji: '🔵', need: 4e4, sphere: ['#a8d8ff', '#2e5fe0', '#0a1a5c'], glow: '#4a7dff', nebula: ['#0f2a6b', '#2a0f5c'], desc: 'Eisige Winde, heiße Deals.' },
  { name: 'Alpha Centauri', emoji: '⭐', need: 2e5, sphere: ['#fffbe0', '#ffd23f', '#d9480f'], glow: '#ffcc33', nebula: ['#5c3a0a', '#5c0a3a'], desc: 'Drei Sonnen, dreifacher Profit.' },
  { name: 'Andromeda', emoji: '🌌', need: 1e6, sphere: ['#ffd6f5', '#b44ad9', '#2a0a4b'], ring: '#e08cff', glow: '#d06aff', nebula: ['#4b0a5c', '#0a2a5c'], desc: 'Eine neue Galaxie wartet.' },
  { name: 'Galaxiekern', emoji: '🕳️', need: 5e6, sphere: ['#ffffff', '#ffb36b', '#1a0a00'], ring: '#ff8a3d', glow: '#ffae5c', nebula: ['#5c2a0a', '#0a0a2a'], desc: 'Das Zentrum von allem. Der Quantensprung wartet.' },
];
