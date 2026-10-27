// Kommandant: Talentbaum (4 Zweige × 8 Reihen) und aktive Fähigkeiten
export type BranchId = 'industrie' | 'wissenschaft' | 'flotte' | 'glueck';

export interface BranchDef {
  id: BranchId;
  name: string;
  emoji: string;
  color: string;
}

export const BRANCHES: BranchDef[] = [
  { id: 'industrie', name: 'Industrie', emoji: '🏭', color: '#ffb347' },
  { id: 'wissenschaft', name: 'Wissenschaft', emoji: '🔬', color: '#a78bfa' },
  { id: 'flotte', name: 'Flotte', emoji: '🚀', color: '#5ad1ff' },
  { id: 'glueck', name: 'Glück', emoji: '🍀', color: '#4ade80' },
];

export type AbilityId = 'overload' | 'insight' | 'jump' | 'shower' | 'warp' | 'build';

export interface TalentDef {
  id: string;
  branch: BranchId;
  /** Reihe 1–8; höhere Reihen brauchen Punkte im Zweig */
  row: number;
  name: string;
  emoji: string;
  max: number;
  /** Entweder-oder: nur ein Talent derselben Gruppe kann gelernt werden */
  group?: string;
  /** Wirkung bei Stufe r (für die Anzeige) */
  desc: (r: number) => string;
  /** schaltet eine aktive Fähigkeit frei */
  ability?: AbilityId;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

export const TALENTS: TalentDef[] = [
  // 🏭 Industrie
  { id: 'i_fliess', branch: 'industrie', row: 1, name: 'Fließband', emoji: '🏭', max: 5, desc: (r) => `Einkommen +${pct(0.1 * r)}` },
  { id: 'i_einkauf', branch: 'industrie', row: 2, name: 'Großeinkauf', emoji: '🛒', max: 3, desc: (r) => `Anlagen −${pct(0.05 * r)} Kosten` },
  { id: 'i_masse', branch: 'industrie', row: 3, group: 'i3', name: 'Massenproduktion', emoji: '🏗️', max: 1, desc: () => 'Anlagen −25 % Kosten' },
  { id: 'i_praez', branch: 'industrie', row: 3, group: 'i3', name: 'Präzision', emoji: '🎯', max: 1, desc: () => 'Meilensteine machen ×2,1 statt ×2 schneller' },
  { id: 'i_planung', branch: 'industrie', row: 4, name: 'Imperium-Planung', emoji: '🏛️', max: 3, desc: (r) => `Imperium-Meilensteine +${String(Math.round(5 * r) / 100).replace('.', ',')} Multiplikator` },
  { id: 'i_turbo', branch: 'industrie', row: 5, name: 'Turbo-Zyklen', emoji: '⚙️', max: 5, desc: (r) => `Zyklen +${pct(0.05 * r)} schneller` },
  { id: 'i_monopol', branch: 'industrie', row: 6, group: 'i6', name: 'Monopol', emoji: '💼', max: 1, desc: () => 'Upgrades kosten die Hälfte' },
  { id: 'i_gross', branch: 'industrie', row: 6, group: 'i6', name: 'Großindustrie', emoji: '🏙️', max: 1, desc: () => 'Anlagen 6–10: Ertrag ×2' },
  { id: 'i_ueber', branch: 'industrie', row: 7, name: 'Überladung', emoji: '⚡', max: 1, ability: 'overload', desc: () => 'Fähigkeit: 30 s lang Einkommen ×10' },
  { id: 'i_meister', branch: 'industrie', row: 8, name: 'Industriemagnat', emoji: '👑', max: 1, desc: () => 'Einkommen ×2' },
  // 🔬 Wissenschaft
  { id: 'w_stern', branch: 'wissenschaft', row: 1, name: 'Sternenkunde', emoji: '✨', max: 5, desc: (r) => `Sternenstaub +${pct(0.05 * r)}` },
  { id: 'w_assist', branch: 'wissenschaft', row: 2, name: 'Laborassistenz', emoji: '🧪', max: 3, desc: (r) => `Labor −${pct(0.1 * r)} Kosten` },
  { id: 'w_nova', branch: 'wissenschaft', row: 3, group: 'w3', name: 'Supernova-Theorie', emoji: '💥', max: 1, desc: () => 'Sternenstaub +20 %' },
  { id: 'w_quant', branch: 'wissenschaft', row: 3, group: 'w3', name: 'Quantenfeldtheorie', emoji: '⚛️', max: 1, desc: () => 'Quantenkerne +20 %' },
  { id: 'w_nacht', branch: 'wissenschaft', row: 4, name: 'Nachtschicht', emoji: '🌙', max: 3, desc: (r) => `Offline-Ertrag +${pct(0.1 * r)}` },
  { id: 'w_speicher', branch: 'wissenschaft', row: 5, name: 'Langzeitspeicher', emoji: '🔋', max: 3, desc: (r) => `Offline-Speicher +${2 * r} h` },
  { id: 'w_kalt', branch: 'wissenschaft', row: 6, group: 'w6', name: 'Kaltstart', emoji: '🧊', max: 1, desc: () => 'Startkapital nach jeder Supernova ×100' },
  { id: 'w_mentor', branch: 'wissenschaft', row: 6, group: 'w6', name: 'Mentor', emoji: '🎓', max: 1, desc: () => 'Kommandanten-XP +25 %' },
  { id: 'w_blitz', branch: 'wissenschaft', row: 7, name: 'Geistesblitz', emoji: '💡', max: 1, ability: 'insight', desc: () => 'Fähigkeit: nächste Supernova +25 % Sternenstaub' },
  { id: 'w_meister', branch: 'wissenschaft', row: 8, name: 'Kosmologe', emoji: '🌌', max: 1, desc: () => 'Sternenstaub ×1,25 und Quantenkerne ×1,15' },
  // 🚀 Flotte
  { id: 'f_nav', branch: 'flotte', row: 1, name: 'Navigation', emoji: '🧭', max: 5, desc: (r) => `Expeditionen −${pct(0.05 * r)} Flugzeit` },
  { id: 'f_fracht', branch: 'flotte', row: 2, name: 'Frachtmeister', emoji: '📦', max: 3, desc: (r) => `Expeditions-Beute +${pct(0.15 * r)}` },
  { id: 'f_kund', branch: 'flotte', row: 3, group: 'f3', name: 'Kundschafter', emoji: '🔭', max: 1, desc: () => 'Erfolgschance +10 %' },
  { id: 'f_schatz', branch: 'flotte', row: 3, group: 'f3', name: 'Schatzsucher', emoji: '🗝️', max: 1, desc: () => 'Artefakt-Chance +25 %' },
  { id: 'f_werft', branch: 'flotte', row: 4, name: 'Werftmeister', emoji: '🔧', max: 3, desc: (r) => `Schiffsmodule −${pct(0.1 * r)} Kosten` },
  { id: 'f_hangar', branch: 'flotte', row: 5, name: 'Erweiterter Hangar', emoji: '🛸', max: 1, desc: () => '+1 Hangar-Platz' },
  { id: 'f_berg', branch: 'flotte', row: 6, group: 'f6', name: 'Bergbauflotte', emoji: '⛏️', max: 1, desc: () => 'Expeditionen bringen doppelte Kolonie-Rohstoffe' },
  { id: 'f_handel', branch: 'flotte', row: 6, group: 'f6', name: 'Handelsflotte', emoji: '💰', max: 1, desc: () => 'Expeditionen bringen +50 % Exotische Materie' },
  { id: 'f_sprung', branch: 'flotte', row: 7, name: 'Notsprung', emoji: '🌀', max: 1, ability: 'jump', desc: () => 'Fähigkeit: ein Schiff kommt sofort zurück' },
  { id: 'f_admiral', branch: 'flotte', row: 8, name: 'Großadmiral', emoji: '🎖️', max: 1, desc: () => 'Expeditions-Beute ×2 und ein zusätzlicher Artefakt-Wurf' },
  // 🍀 Glück
  { id: 'g_komet', branch: 'glueck', row: 1, name: 'Kometenjäger', emoji: '☄️', max: 5, desc: (r) => `Kometen +${pct(0.1 * r)} häufiger` },
  { id: 'g_pilz', branch: 'glueck', row: 2, name: 'Glückspilz', emoji: '🍀', max: 3, desc: (r) => `Kometen-Belohnung +${pct(0.25 * r)}` },
  { id: 'g_spieler', branch: 'glueck', row: 3, group: 'g3', name: 'Spieler', emoji: '🎲', max: 1, desc: () => 'Riskante Funkspruch-Entscheidungen gelingen +15 % öfter' },
  { id: 'g_diplomat', branch: 'glueck', row: 3, group: 'g3', name: 'Diplomat', emoji: '🤝', max: 1, desc: () => 'Ruf-Gewinne bei Fraktionen +50 %' },
  { id: 'g_kristall', branch: 'glueck', row: 4, name: 'Kristallsucher', emoji: '💎', max: 3, desc: (r) => `Kristalle +${pct(0.1 * r)}` },
  { id: 'g_funk', branch: 'glueck', row: 5, name: 'Funkoffizier', emoji: '📡', max: 3, desc: (r) => `Funksprüche ${pct(0.15 * r)} häufiger` },
  { id: 'g_jackpot', branch: 'glueck', row: 6, group: 'g6', name: 'Jackpot', emoji: '🎰', max: 1, desc: () => 'Geldregen-Kometen bringen ×3' },
  { id: 'g_serie', branch: 'glueck', row: 6, group: 'g6', name: 'Glückssträhne', emoji: '📅', max: 1, desc: () => 'Tägliche Belohnung: doppelte Kristalle' },
  { id: 'g_schauer', branch: 'glueck', row: 7, name: 'Kometenschauer', emoji: '🌠', max: 1, ability: 'shower', desc: () => 'Fähigkeit: 5 goldene Kometen auf einmal' },
  { id: 'g_fortuna', branch: 'glueck', row: 8, name: 'Fortuna', emoji: '🌟', max: 1, desc: () => 'Kometen, Funksprüche und Expeditionen bringen +25 %' },
];

export const TALENT_INDEX: Record<string, TalentDef> = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

/** Punkte, die im Zweig ausgegeben sein müssen, um Reihe `row` zu öffnen */
export function rowRequirement(row: number): number {
  return (row - 1) * 2;
}

export interface AbilityDef {
  id: AbilityId;
  name: string;
  emoji: string;
  desc: string;
  /** Abklingzeit in Sekunden */
  cooldown: number;
  /** freigeschaltet durch ein Talent … */
  talent?: string;
  /** … oder ab einem Kommandanten-Level */
  rank?: number;
}

export const ABILITIES: AbilityDef[] = [
  { id: 'overload', name: 'Überladung', emoji: '⚡', desc: '30 Sekunden lang Einkommen ×10.', cooldown: 600, talent: 'i_ueber' },
  { id: 'insight', name: 'Geistesblitz', emoji: '💡', desc: 'Deine nächste Supernova bringt +25 % Sternenstaub.', cooldown: 1800, talent: 'w_blitz' },
  { id: 'jump', name: 'Notsprung', emoji: '🌀', desc: 'Das Schiff mit der längsten Restflugzeit ist sofort zurück.', cooldown: 7200, talent: 'f_sprung' },
  { id: 'shower', name: 'Kometenschauer', emoji: '🌠', desc: 'Fünf goldene Kometen fliegen vorbei – schnell antippen!', cooldown: 1200, talent: 'g_schauer' },
  { id: 'warp', name: 'Zeitriss', emoji: '⏩', desc: 'Sofort 15 Minuten Ertrag.', cooldown: 3600, rank: 15 },
  { id: 'build', name: 'Sofortbau', emoji: '🏗️', desc: 'Der Kolonie-Bau mit der längsten Restzeit ist sofort fertig.', cooldown: 14400, rank: 25 },
];

export const ABILITY_INDEX: Record<string, AbilityDef> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

/** so viele Fähigkeiten passen in die Leiste */
export const ABILITY_SLOTS = 4;
