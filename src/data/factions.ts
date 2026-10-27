// Vier Fraktionen mit Ruf-Stufen, dauerhaften Vorteilen und einem Wochen-Shop
export type FactionId = 'gilde' | 'akademie' | 'flotte' | 'zyrak';

export interface FactionDef {
  id: FactionId;
  name: string;
  emoji: string;
  color: string;
  leader: string;
  desc: string;
  /** Vorteil je Ruf-Stufe 1–5 */
  perks: string[];
}

/** Ruf, ab dem die Stufen 1–5 erreicht sind */
export const REP_LEVELS = [100, 300, 700, 1500, 3000];
export const REP_NAMES = ['Neutral', 'Bekannt', 'Geschätzt', 'Verbündet', 'Geehrt', 'Legendär'];

export const FACTIONS: FactionDef[] = [
  {
    id: 'gilde', name: 'Händlergilde', emoji: '💰', color: '#fbbf24', leader: '🤑 Zorg der Händler',
    desc: 'Wer Geld hat, hat Freunde. Wer Zorg kennt, hat bessere Preise.',
    perks: ['Anlagen −5 % Kosten', 'Upgrades −10 % Kosten', 'Kristalle +15 %', 'Megaprojekte −10 % Rohstoffe', 'Einkommen ×2'],
  },
  {
    id: 'akademie', name: 'Akademie der Sterne', emoji: '🔬', color: '#a78bfa', leader: '🧑‍🔬 Professor Plasma',
    desc: 'Forschung ist, wenn es trotzdem knallt – nur kontrollierter.',
    perks: ['Sternenstaub +10 %', 'Labor −10 % Kosten', '+2 Talentpunkte', 'Quantenkerne +15 %', 'Sternenstaub ×1,5'],
  },
  {
    id: 'flotte', name: 'Flottenkommando', emoji: '⚔️', color: '#5ad1ff', leader: '👩‍✈️ Admiralin Vega',
    desc: 'Ordnung im All. Mit Schilden, Kanonen und sehr strengen Dienstplänen.',
    perks: ['Expeditionen −10 % Flugzeit', 'Expeditions-Beute +25 %', '+1 Hangar-Platz', 'Erfolgschance +10 %', 'Ein zusätzlicher Artefakt-Wurf'],
  },
  {
    id: 'zyrak', name: "Zyr'ak-Kollektiv", emoji: '👽', color: '#4ade80', leader: '🛸 Die Stimme',
    desc: 'Uralt, neugierig und schwer zu durchschauen. Sie sammeln Geschichten – und Artefakte.',
    perks: ['Artefakt-Chance +15 %', 'Kometen-Belohnung +50 %', '+1 Artefakt-Platz', 'Offline-Ertrag +15 %', 'Alle Artefakte wirken +50 % stärker'],
  },
];

export const FACTION_INDEX: Record<string, FactionDef> = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));

export function repLevel(rep: number): number {
  let l = 0;
  for (const t of REP_LEVELS) if (rep >= t) l++;
  return l;
}

/** Wochen-Angebote im Fraktions-Shop (ab Ruf-Stufe 1, je Woche einmal) */
export interface OfferDef {
  id: string;
  faction: FactionId;
  name: string;
  emoji: string;
  desc: string;
  /** benötigte Ruf-Stufe */
  level: number;
  price: { gems?: number; em?: number };
}

export const OFFERS: OfferDef[] = [
  { id: 'o_res', faction: 'gilde', name: 'Rohstoffkiste', emoji: '📦', desc: 'Metall, Kristall und Deuterium für deine Kolonien', level: 1, price: { em: 150 } },
  { id: 'o_gems', faction: 'gilde', name: 'Kristall-Deal', emoji: '💎', desc: '60 Kristalle', level: 2, price: { em: 400 } },
  { id: 'o_boost', faction: 'gilde', name: 'Goldene Stunde', emoji: '🔥', desc: '1 Stunde lang Einkommen ×3', level: 3, price: { gems: 30 } },
  { id: 'o_chips', faction: 'akademie', name: 'Chip-Lieferung', emoji: '💾', desc: 'Quantenchips aus dem Akademie-Labor', level: 1, price: { em: 250 } },
  { id: 'o_xp', faction: 'akademie', name: 'Privatunterricht', emoji: '🎓', desc: 'Die Hälfte eines Kommandanten-Levels an XP', level: 2, price: { gems: 50 } },
  { id: 'o_dust', faction: 'akademie', name: 'Staubprobe', emoji: '✨', desc: '+3 % deines Sternenstaubs sofort', level: 3, price: { gems: 120 } },
  { id: 'o_alloy', faction: 'flotte', name: 'Rüstungsgüter', emoji: '🧱', desc: 'Legierung aus Flottenbeständen', level: 1, price: { em: 250 } },
  { id: 'o_em', faction: 'flotte', name: 'Treibstoff-Depot', emoji: '⚗️', desc: '300 Exotische Materie', level: 2, price: { gems: 30 } },
  { id: 'o_crate', faction: 'flotte', name: 'Beutekiste', emoji: '🎁', desc: 'Ein Artefakt – mindestens selten', level: 3, price: { em: 500 } },
  { id: 'o_warp', faction: 'zyrak', name: 'Zeitfalte', emoji: '🌀', desc: 'Zeitsprung: 4 Stunden Ertrag', level: 1, price: { gems: 70 } },
  { id: 'o_epic', faction: 'zyrak', name: 'Zyr’ak-Relikt', emoji: '🔮', desc: 'Ein Artefakt – mindestens episch', level: 2, price: { em: 900 } },
  { id: 'o_legend', faction: 'zyrak', name: 'Sternenerbe', emoji: '🌟', desc: 'Ein legendäres Artefakt', level: 4, price: { em: 1800, gems: 100 } },
];
