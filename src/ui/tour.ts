// Geführte Tour durch neue Bereiche: „NEU“-Punkt am Tab und eine Einführung beim ersten Öffnen
import { coloniesUnlocked } from '../core/colonies';
import { commanderUnlocked } from '../core/commander';
import type { GameState } from '../core/state';
import { G, type TabId } from './ctx';
import { showModal } from './modal';

interface Intro {
  hero: string;
  title: string;
  body: string[];
  unlocked: (s: GameState) => boolean;
}

const INTROS: Partial<Record<TabId, Intro>> = {
  kommandant: {
    hero: '👤',
    title: 'Dein Kommando',
    body: [
      'Für jedes Kommandanten-Level bekommst du einen <b>Talentpunkt</b>. Verteile sie in vier Zweigen: 🏭 Industrie, 🔬 Wissenschaft, 🚀 Flotte und 🍀 Glück.',
      'In manchen Reihen musst du dich <b>entscheiden</b> – nur eines von zwei Talenten geht. Umskillen kostet Kristalle.',
      'Oben im Zweig warten <b>aktive Fähigkeiten</b> wie ⚡ Überladung. Sie erscheinen als Knöpfe in der Kopfzeile.',
    ],
    unlocked: commanderUnlocked,
  },
  kolonien: {
    hero: '🪐',
    title: 'Deine Kolonien',
    body: [
      'Jeder Planet, den du erreicht hast, ist jetzt eine <b>Kolonie</b>. Baue Minen, Kristallbohrer und Deuteriumpumpen – sie produzieren rund um die Uhr, auch offline.',
      'Jedes Gebäude braucht <b>⚡ Energie</b>. Fehlt Strom, läuft die ganze Kolonie langsamer. Kolonien behältst du für immer – auch nach Supernova und Galaxie-Sprung.',
      'Aus Legierung und Quantenchips baust du <b>Megaprojekte</b>, die das ganze Spiel verändern.',
    ],
    unlocked: coloniesUnlocked,
  },
};

/** Neuer, freigeschalteter Bereich, der noch nie geöffnet wurde? */
export function tabIsNew(tab: TabId): boolean {
  const intro = INTROS[tab];
  return !!intro && intro.unlocked(G.s) && !G.s.tutorial.flags['seen_' + tab];
}

/** Beim ersten Öffnen eines neuen Bereichs die Einführung zeigen */
export function onTabOpened(tab: TabId): void {
  if (!tabIsNew(tab)) return;
  const intro = INTROS[tab]!;
  G.s.tutorial.flags['seen_' + tab] = true;
  showModal({ hero: intro.hero, title: intro.title, body: intro.body, actions: [{ label: 'Verstanden', cls: 'violet' }] });
}
