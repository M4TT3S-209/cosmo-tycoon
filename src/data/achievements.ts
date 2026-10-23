import { BUILDINGS } from './buildings';
import { PLANETS } from './planets';
import type { GameState } from '../core/state';
import { fmt } from '../core/format';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  gems: number;
  /** aktueller Wert und Ziel, für Fortschrittsbalken */
  progress: (s: GameState) => [number, number];
}

const list: AchievementDef[] = [];

const RANKS: [number, string, number][] = [
  [25, 'Lehrling', 2],
  [100, 'Profi', 4],
  [250, 'Meister', 8],
  [500, 'Legende', 15],
];
for (const b of BUILDINGS) {
  for (const [n, rank, gems] of RANKS) {
    list.push({
      id: `own_${b.id}_${n}`,
      name: `${b.name}: ${rank}`,
      desc: `Besitze ${n} × ${b.name}`,
      emoji: b.emoji,
      gems,
      progress: (s) => [s.buildings[b.id].owned, n],
    });
  }
}

const EARN: [number, string][] = [
  [1e6, 'Erste Million'], [1e9, 'Milliardär'], [1e12, 'Billionär'], [1e15, 'Billiardär'],
  [1e18, 'Trillionär'], [1e24, 'Quadrillionär'], [1e30, 'Quintillionär'], [1e45, 'Unfassbar reich'],
  [1e60, 'Kosmischer Krösus'], [1e80, 'Jenseits der Zahlen'],
];
EARN.forEach(([n, name], i) => {
  list.push({
    id: `earn_${i}`, name, desc: `Verdiene insgesamt ${fmt(n)} 🪙`, emoji: '💰',
    gems: 3 + i * 2, progress: (s) => [s.totalEarnings, n],
  });
});

const SN: [number, string][] = [[1, 'Erste Supernova'], [3, 'Sternenfresser'], [10, 'Kosmischer Zyklus'], [25, 'Explosiv'], [50, 'Supernova-Süchtig'], [100, 'Ewige Wiedergeburt']];
SN.forEach(([n, name], i) => {
  list.push({
    id: `sn_${n}`, name, desc: `Löse ${n} Supernova${n > 1 ? 's' : ''} aus`, emoji: '💥',
    gems: 5 + i * 5, progress: (s) => [s.totalSupernovas, n],
  });
});

PLANETS.forEach((p, i) => {
  if (i === 0) return;
  list.push({
    id: `planet_${i}`, name: `Ankunft: ${p.name}`, desc: `Erreiche ${p.name}`, emoji: p.emoji,
    gems: 5 + i * 3, progress: (s) => [s.galaxyJumps > 0 ? i : Math.min(s.planet, i), i],
  });
});

const COMETS: [number, string][] = [[1, 'Sternschnuppe'], [10, 'Kometenjäger'], [50, 'Schweifsammler'], [200, 'Meteor-Magnet'], [500, 'Herr der Kometen']];
COMETS.forEach(([n, name], i) => {
  list.push({
    id: `comet_${n}`, name, desc: `Fange ${n} goldene${n > 1 ? '' : 'n'} Komet${n > 1 ? 'en' : 'en'}`, emoji: '☄️',
    gems: 2 + i * 3, progress: (s) => [s.stats.cometsTapped, n],
  });
});

list.push({
  id: 'allmgr', name: 'Volle Belegschaft', desc: 'Stelle alle 10 Manager in einem Durchlauf ein', emoji: '👔',
  gems: 10, progress: (s) => [s.managers.filter(Boolean).length, s.managers.length],
});

const UPG: [number, string][] = [[10, 'Tüftler'], [50, 'Ingenieur'], [150, 'Technologie-Gott']];
UPG.forEach(([n, name], i) => {
  list.push({
    id: `upg_${n}`, name, desc: `Kaufe insgesamt ${n} Upgrades`, emoji: '⬆️',
    gems: 3 + i * 5, progress: (s) => [s.stats.upgradesBought, n],
  });
});

const QUESTS: [number, string][] = [[5, 'Pflichtbewusst'], [25, 'Missionsspezialist'], [100, 'Held der Galaxis']];
QUESTS.forEach(([n, name], i) => {
  list.push({
    id: `quest_${n}`, name, desc: `Schließe ${n} Missionen ab`, emoji: '🎯',
    gems: 4 + i * 6, progress: (s) => [s.stats.questsDone, n],
  });
});

list.push({
  id: 'streak7', name: 'Treue Seele', desc: 'Hole dir 7 Tage in Folge die tägliche Belohnung', emoji: '📅',
  gems: 15, progress: (s) => [s.daily.streak, 7],
});

const DAYS: [number, string][] = [[3, 'Stammgast'], [14, 'Veteran'], [30, 'Weltraum-Urgestein']];
DAYS.forEach(([n, name], i) => {
  list.push({
    id: `days_${n}`, name, desc: `Spiele an ${n} verschiedenen Tagen`, emoji: '🗓️',
    gems: 5 + i * 8, progress: (s) => [s.stats.daysPlayed, n],
  });
});

list.push({
  id: 'gj_1', name: 'Quantensprung', desc: 'Führe einen Galaxie-Sprung durch', emoji: '⚛️',
  gems: 50, progress: (s) => [s.galaxyJumps, 1],
});
list.push({
  id: 'gj_5', name: 'Multiversum', desc: 'Führe 5 Galaxie-Sprünge durch', emoji: '🌠',
  gems: 100, progress: (s) => [s.galaxyJumps, 5],
});

const TAPS: [number, string][] = [[100, 'Fleißige Finger'], [1000, 'Tipp-Tornado'], [10000, 'Daumen aus Stahl']];
TAPS.forEach(([n, name], i) => {
  list.push({
    id: `taps_${n}`, name, desc: `Tippe ${fmt(n)} mal auf Anlagen`, emoji: '👆',
    gems: 2 + i * 4, progress: (s) => [s.stats.taps, n],
  });
});

export const ACHIEVEMENTS: AchievementDef[] = list;
