// Wirkung der gelernten Talente, der Fraktions-Stufen und der Megaprojekte –
// bewusst ohne weitere Abhängigkeiten (wird von economy.ts genutzt)
import { repLevel } from '../data/factions';
import { weeklyModFor } from '../data/weekly';
import type { GameState } from './state';

export interface TalentBonus {
  /** × Einkommen */
  income: number;
  /** × Anlagen-Kosten */
  cost: number;
  /** Tempo-Faktor pro Meilenstein (2 bzw. 2,2) */
  milestoneBase: number;
  /** + auf den Imperium-Multiplikator */
  empirePlus: number;
  /** × Zyklus-Tempo */
  speed: number;
  /** × Upgrade-Kosten */
  upgradeCost: number;
  /** × Ertrag der Anlagen 6–10 */
  bigBuildings: number;
  /** × Sternenstaub */
  dust: number;
  /** × Labor-Kosten */
  labCost: number;
  /** × Quantenkerne */
  quantum: number;
  /** + Offline-Effizienz */
  offlineEff: number;
  /** + Offline-Speicher in Stunden */
  offlineHours: number;
  /** × Startkapital */
  startCash: number;
  /** × Kommandanten-XP */
  xp: number;
  /** Anteil kürzerer Flugzeit */
  expSpeed: number;
  /** × Expeditions-Beute */
  expLoot: number;
  /** + Erfolgschance */
  expSuccess: number;
  /** × Artefakt-Chance */
  artChance: number;
  /** × Modul-Kosten */
  moduleCost: number;
  /** + Hangar-Plätze */
  hangar: number;
  /** × Kolonie-Rohstoffe aus Expeditionen */
  resLoot: number;
  /** × Exotische Materie aus Expeditionen */
  emLoot: number;
  /** + zusätzliche Artefakt-Würfe */
  extraArtRoll: number;
  /** × Kometen-Häufigkeit */
  cometFreq: number;
  /** × Kometen-Belohnung */
  cometLuck: number;
  /** × Geldregen */
  cashComet: number;
  /** × Kristalle */
  gems: number;
  /** × Funkspruch-Häufigkeit */
  eventFreq: number;
  /** + Erfolgschance riskanter Entscheidungen */
  riskBonus: number;
  /** × Ruf-Gewinne */
  repMult: number;
  /** × Kristalle der täglichen Belohnung */
  dailyMult: number;
  /** × Zufallsbelohnungen (Kometen, Funksprüche, Expeditionen) */
  randomLoot: number;
  /** × Rohstoffkosten der Megaprojekte */
  megaCost: number;
  /** + Talentpunkte */
  talentPoints: number;
  /** + Artefakt-Plätze */
  artSlots: number;
  /** × Stärke aller Artefakte */
  artPower: number;
}

const DEFAULT: TalentBonus = {
  income: 1, cost: 1, milestoneBase: 2, empirePlus: 0, speed: 1, upgradeCost: 1, bigBuildings: 1, dust: 1, labCost: 1,
  quantum: 1, offlineEff: 0, offlineHours: 0, startCash: 1, xp: 1, expSpeed: 0, expLoot: 1, expSuccess: 0, artChance: 1,
  moduleCost: 1, hangar: 0, resLoot: 1, emLoot: 1, extraArtRoll: 0, cometFreq: 1, cometLuck: 1, cashComet: 1, gems: 1,
  eventFreq: 1, riskBonus: 0, repMult: 1, dailyMult: 1, randomLoot: 1, megaCost: 1, talentPoints: 0, artSlots: 0,
  artPower: 1,
};

const tb: TalentBonus = { ...DEFAULT };

/** erreichte Stufe eines Megaprojekts (0–5) */
export function megaStage(s: GameState, id: string): number {
  return s.mega?.stages[id] ?? 0;
}

/** Summe aller Talent-, Fraktions- und Megaprojekt-Wirkungen. Wiederverwendetes Objekt – sofort auslesen. */
export function talentBonus(s: GameState): TalentBonus {
  Object.assign(tb, DEFAULT);
  factionPerks(s);
  megaPerks(s);
  weeklyPerks(s);
  const t = s.commander?.talents;
  if (!t) return tb;
  for (const id in t) {
    const r = t[id];
    if (!(r > 0)) continue;
    switch (id) {
      case 'i_fliess': tb.income *= 1 + 0.1 * r; break;
      case 'i_einkauf': tb.cost *= 1 - 0.05 * r; break;
      case 'i_masse': tb.cost *= 0.75; break;
      case 'i_praez': tb.milestoneBase = 2.1; break;
      case 'i_planung': tb.empirePlus += 0.05 * r; break;
      case 'i_turbo': tb.speed *= 1 + 0.05 * r; break;
      case 'i_monopol': tb.upgradeCost *= 0.5; break;
      case 'i_gross': tb.bigBuildings *= 2; break;
      case 'i_meister': tb.income *= 2; break;
      case 'w_stern': tb.dust *= 1 + 0.05 * r; break;
      case 'w_assist': tb.labCost *= 1 - 0.1 * r; break;
      case 'w_nova': tb.dust *= 1.2; break;
      case 'w_quant': tb.quantum *= 1.2; break;
      case 'w_nacht': tb.offlineEff += 0.1 * r; break;
      case 'w_speicher': tb.offlineHours += 2 * r; break;
      case 'w_kalt': tb.startCash *= 100; break;
      case 'w_mentor': tb.xp *= 1.25; break;
      case 'w_meister': tb.dust *= 1.25; tb.quantum *= 1.15; break;
      case 'f_nav': tb.expSpeed += 0.05 * r; break;
      case 'f_fracht': tb.expLoot *= 1 + 0.15 * r; break;
      case 'f_kund': tb.expSuccess += 0.1; break;
      case 'f_schatz': tb.artChance *= 1.25; break;
      case 'f_werft': tb.moduleCost *= 1 - 0.1 * r; break;
      case 'f_hangar': tb.hangar += 1; break;
      case 'f_berg': tb.resLoot *= 2; break;
      case 'f_handel': tb.emLoot *= 1.5; break;
      case 'f_admiral': tb.expLoot *= 2; tb.extraArtRoll += 1; break;
      case 'g_komet': tb.cometFreq *= 1 + 0.1 * r; break;
      case 'g_pilz': tb.cometLuck *= 1 + 0.25 * r; break;
      case 'g_spieler': tb.riskBonus += 0.15; break;
      case 'g_diplomat': tb.repMult *= 1.5; break;
      case 'g_kristall': tb.gems *= 1 + 0.1 * r; break;
      case 'g_funk': tb.eventFreq *= 1 + 0.15 * r; break;
      case 'g_jackpot': tb.cashComet *= 3; break;
      case 'g_serie': tb.dailyMult *= 2; break;
      case 'g_fortuna': tb.randomLoot *= 1.25; break;
    }
  }
  return tb;
}

/** Wirkung der Megaprojekte (siehe MEGAPROJECTS in data/megaprojects.ts; Dyson und Terraformer wirken anderswo) */
function megaPerks(s: GameState): void {
  const tor = megaStage(s, 'tor');
  tb.quantum *= 1 + [0, 0.1, 0.2, 0.2, 0.35, 0.35][tor];
  const rechner = megaStage(s, 'rechner');
  tb.labCost *= [1, 0.9, 0.8, 0.8, 0.7, 0.7][rechner];
  if (rechner >= 5) tb.talentPoints += 2;
  const chrono = megaStage(s, 'chrono');
  tb.offlineHours += 4 * chrono;
  tb.offlineEff += 0.1 * chrono;
  const archiv = megaStage(s, 'archiv');
  tb.artSlots += archiv;
  if (archiv >= 5) tb.artPower *= 1.5;
}

/** Bedingung der Woche (siehe WEEKLY_MODS in data/weekly.ts; Rohstoff-Boom und Sonnensturm wirken in colonies.ts) */
function weeklyPerks(s: GameState): void {
  switch (weeklyModFor(s.weekly?.key ?? '')?.id) {
    case 'sonne': tb.expSuccess -= 0.1; break;
    case 'komet': tb.cometFreq *= 2; break;
    case 'funk': tb.eventFreq *= 2; break;
    case 'materie': tb.emLoot *= 2; break;
    case 'staub': tb.dust *= 1.25; break;
    case 'industrie': tb.cost *= 0.9; break;
    case 'forschung': tb.labCost *= 0.8; break;
    case 'gipfel': tb.repMult *= 2; break;
    case 'manoever': tb.expSpeed += 0.25; tb.xp *= 1.5; break;
  }
}

/** Vorteile der Fraktionen je erreichter Ruf-Stufe (siehe FACTIONS in data/factions.ts) */
function factionPerks(s: GameState): void {
  const f = s.factions;
  if (!f) return;
  const g = repLevel(f.gilde ?? 0);
  if (g >= 1) tb.cost *= 0.95;
  if (g >= 2) tb.upgradeCost *= 0.9;
  if (g >= 3) tb.gems *= 1.15;
  if (g >= 4) tb.megaCost *= 0.9;
  if (g >= 5) tb.income *= 2;
  const a = repLevel(f.akademie ?? 0);
  if (a >= 1) tb.dust *= 1.1;
  if (a >= 2) tb.labCost *= 0.9;
  if (a >= 3) tb.talentPoints += 2;
  if (a >= 4) tb.quantum *= 1.15;
  if (a >= 5) tb.dust *= 1.5;
  const v = repLevel(f.flotte ?? 0);
  if (v >= 1) tb.expSpeed += 0.1;
  if (v >= 2) tb.expLoot *= 1.25;
  if (v >= 3) tb.hangar += 1;
  if (v >= 4) tb.expSuccess += 0.1;
  if (v >= 5) tb.extraArtRoll += 1;
  const z = repLevel(f.zyrak ?? 0);
  if (z >= 1) tb.artChance *= 1.15;
  if (z >= 2) tb.cometLuck *= 1.5;
  if (z >= 3) tb.artSlots += 1;
  if (z >= 4) tb.offlineEff += 0.15;
  if (z >= 5) tb.artPower *= 1.5;
}
