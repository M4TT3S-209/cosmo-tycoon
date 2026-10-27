// Megaprojekte: riesige Bauvorhaben in 5 Stufen, die die Spielregeln verändern
import type { ResId } from '../core/state';

export interface MegaDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** Wirkung je erreichter Stufe 1–5 */
  stages: string[];
  /** Kosten für Stufe 1 (jede weitere ×3) */
  cost: Partial<Record<ResId, number>> & { em?: number };
}

export const MEGA_STAGES = 5;
export const MEGA_COST_GROWTH = 3;
/** Bauzeit je Stufe in Stunden */
export const MEGA_HOURS = [1, 3, 8, 16, 24];

export const MEGAPROJECTS: MegaDef[] = [
  {
    id: 'dyson', name: 'Dyson-Schwarm', emoji: '🌞', desc: 'Milliarden Spiegel fangen das Licht einer ganzen Sonne ein.',
    stages: ['Einkommen ×2', 'Einkommen ×4', 'Einkommen ×8', 'Einkommen ×16', 'Einkommen ×32'],
    cost: { alloy: 1500, chips: 500, crystal: 4000, em: 150 },
  },
  {
    id: 'tor', name: 'Sternentor', emoji: '🌀', desc: 'Ein Tor zwischen den Galaxien – der Sprung wird leichter.',
    stages: ['Quantenkerne +10 %', 'Quantenkerne +20 %', 'Automatik-Forschung bleibt beim Galaxie-Sprung', 'Quantenkerne +35 %', 'Galaxie-Sprung startet einen Planeten weiter'],
    cost: { alloy: 2500, chips: 1200, deut: 4000, em: 300 },
  },
  {
    id: 'rechner', name: 'Quantenrechner', emoji: '🧠', desc: 'Ein Computer so groß wie ein Mond. Er denkt schneller als die Akademie.',
    stages: ['Labor −10 % Kosten', 'Labor −20 % Kosten', 'Auto-Labor: kauft Forschung automatisch', 'Labor −30 % Kosten', '+2 Talentpunkte'],
    cost: { chips: 1500, crystal: 5000, em: 200 },
  },
  {
    id: 'chrono', name: 'Chronosphäre', emoji: '⏳', desc: 'Hier vergeht die Zeit anders – vor allem, während du schläfst.',
    stages: ['Offline +4 h, +10 % Ertrag', 'Offline +8 h, +20 % Ertrag', 'Offline +12 h, +30 % Ertrag', 'Offline +16 h, +40 % Ertrag', 'Offline +20 h, +50 % Ertrag'],
    cost: { alloy: 1200, chips: 800, deut: 3000, em: 150 },
  },
  {
    id: 'archiv', name: 'Archiv der Architekten', emoji: '🏛️', desc: 'Ein Museum für Dinge, die älter sind als Sterne.',
    stages: ['+1 Artefakt-Platz', '+2 Artefakt-Plätze', '+3 Artefakt-Plätze', '+4 Artefakt-Plätze', '+5 Artefakt-Plätze, Artefakte ×1,5'],
    cost: { alloy: 2000, crystal: 6000, em: 400 },
  },
  {
    id: 'terra', name: 'Terraformer', emoji: '🌱', desc: 'Macht aus Wüsten Gärten – und aus Gärten Bauland.',
    stages: ['+1 Bauplatz in allen Kolonien', '+2 Bauplätze', '+3 Bauplätze', '+4 Bauplätze', '+5 Bauplätze, Kolonie-Produktion ×1,5'],
    cost: { metal: 12000, alloy: 1500, chips: 400, em: 100 },
  },
  {
    id: 'boerse', name: 'Galaktische Börse', emoji: '💱', desc: 'Hier wird alles gehandelt – sogar Exotische Materie.',
    stages: ['Börse öffnet: Rohstoffe gegen ⚗️ tauschen', 'Bessere Kurse (+50 %)', 'Bessere Kurse (+100 %)', 'Bessere Kurse (+150 %)', 'Tägliche Dividende: 50 💎'],
    cost: { metal: 8000, crystal: 4000, alloy: 800, em: 50 },
  },
];

export const MEGA_INDEX: Record<string, MegaDef> = Object.fromEntries(MEGAPROJECTS.map((m) => [m.id, m]));
