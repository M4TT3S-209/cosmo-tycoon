export interface ExpeditionDef {
  id: string;
  name: string;
  emoji: string;
  /** benötigter Planet (höchster je erreichter) */
  minPlanet: number;
  minutes: number;
  /** Grund-Erfolgschance 0..1 */
  success: number;
  em: number;
  /** Chance auf ein Artefakt */
  artifact: number;
  /** Gewichte für gewöhnlich, selten, episch, legendär */
  weights: [number, number, number, number];
  xp: number;
  desc: string;
}

export const EXPEDITIONS: ExpeditionDef[] = [
  { id: 'mond', name: 'Mondkrater', emoji: '🌕', minPlanet: 0, minutes: 15, success: 0.95, em: 8, artifact: 0.15, weights: [80, 18, 2, 0], xp: 15, desc: 'Ein kurzer Ausflug zu den alten Mondminen.' },
  { id: 'asteroiden', name: 'Asteroidenfeld', emoji: '☄️', minPlanet: 1, minutes: 30, success: 0.9, em: 18, artifact: 0.2, weights: [75, 21, 4, 0], xp: 25, desc: 'Ausweichen, scannen, einsammeln.' },
  { id: 'mars', name: 'Marswüste', emoji: '🔴', minPlanet: 2, minutes: 60, success: 0.88, em: 40, artifact: 0.28, weights: [65, 27, 7, 1], xp: 40, desc: 'Unter dem roten Sand liegen alte Ruinen.' },
  { id: 'jupiter', name: 'Jupiter-Stürme', emoji: '🟠', minPlanet: 3, minutes: 120, success: 0.85, em: 90, artifact: 0.35, weights: [55, 32, 11, 2], xp: 70, desc: 'Mitten hinein in den Großen Roten Fleck.' },
  { id: 'saturn', name: 'Saturn-Ringe', emoji: '🪐', minPlanet: 4, minutes: 240, success: 0.82, em: 200, artifact: 0.45, weights: [45, 35, 16, 4], xp: 120, desc: 'Eiskristalle voller Exotischer Materie.' },
  { id: 'neptun', name: 'Neptun-Tiefsee', emoji: '🔵', minPlanet: 5, minutes: 360, success: 0.8, em: 320, artifact: 0.5, weights: [38, 37, 20, 5], xp: 170, desc: 'Ein Ozean aus flüssigem Diamant.' },
  { id: 'centauri', name: 'Centauri-Ruinen', emoji: '⭐', minPlanet: 6, minutes: 480, success: 0.78, em: 480, artifact: 0.6, weights: [30, 38, 25, 7], xp: 230, desc: 'Eine verlassene Alien-Zivilisation.' },
  { id: 'andromeda', name: 'Andromeda-Nebel', emoji: '🌌', minPlanet: 7, minutes: 720, success: 0.75, em: 800, artifact: 0.7, weights: [22, 38, 30, 10], xp: 340, desc: 'Hier verirrt sich sogar das Licht.' },
  { id: 'horizont', name: 'Ereignishorizont', emoji: '🕳️', minPlanet: 8, minutes: 1440, success: 0.7, em: 1800, artifact: 0.85, weights: [15, 35, 35, 15], xp: 650, desc: 'Nur nicht zu nah ran …' },
  { id: 'kern', name: 'Galaxiekern-Tiefen', emoji: '💫', minPlanet: 9, minutes: 2880, success: 0.65, em: 4000, artifact: 1, weights: [8, 30, 40, 22], xp: 1200, desc: 'Die gefährlichste Reise des Universums.' },
];

export const EXPEDITION_INDEX: Record<string, ExpeditionDef> = Object.fromEntries(EXPEDITIONS.map((e) => [e.id, e]));

export type ModuleId = 'engine' | 'cargo' | 'shield';

export const SHIP_MODULES: { id: ModuleId; name: string; emoji: string; base: number; desc: (l: number) => string }[] = [
  { id: 'engine', name: 'Antrieb', emoji: '🔥', base: 15, desc: (l) => `−${Math.round(Math.min(0.5, l * 0.02) * 100)} % Flugzeit` },
  { id: 'cargo', name: 'Laderaum', emoji: '📦', base: 20, desc: (l) => `+${l * 8} % Beute` },
  { id: 'shield', name: 'Schilde', emoji: '🛡️', base: 12, desc: (l) => `+${l} % Erfolgschance` },
];

export const MODULE_MAX = 25;
export const MODULE_COST_MULT = 1.25;
export const CRATE_COST = 300;

export const SHIP_NAMES = ['Kolibri', 'Sternfalke', 'Nebelkreuzer', 'Kometenjäger', 'Leviathan', 'Odyssee'];
