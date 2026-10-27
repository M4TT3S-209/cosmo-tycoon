// Funksprüche: Ereignisse mit Entscheidungen. Beträge wachsen mit dem Fortschritt:
// Geld in Sekunden Einkommen, Sternenstaub als Anteil des verdienten, Rohstoffe mit der Kolonie-Größe.
import type { Rarity } from './artifacts';
import type { FactionId } from './factions';
import type { ResId } from '../core/state';

export type Effect =
  | { t: 'cash'; sec: number }
  | { t: 'gems'; n: number }
  | { t: 'em'; n: number }
  | { t: 'res'; r: Partial<Record<ResId, number>> }
  | { t: 'boost'; kind: 'income' | 'speed'; mult: number; min: number }
  | { t: 'dust'; pct: number }
  | { t: 'artifact'; min: Rarity }
  | { t: 'rep'; f: FactionId; n: number }
  | { t: 'xp'; frac: number }
  | { t: 'comets'; n: number }
  | { t: 'chain'; id: string; min: number };

export interface Outcome {
  text: string;
  effects: Effect[];
}

export interface Cost {
  gems?: number;
  em?: number;
  /** Sekunden Einkommen */
  cashSec?: number;
  res?: Partial<Record<ResId, number>>;
}

export interface ChoiceDef {
  label: string;
  cost?: Cost;
  /** Erfolgschance 0..1 (ohne: sicher) */
  chance?: number;
  win: Outcome;
  lose?: Outcome;
}

export interface EventDef {
  id: string;
  title: string;
  from: string;
  hero: string;
  text: string;
  faction?: FactionId;
  minPlanet?: number;
  weight?: number;
  /** nur als Folge eines anderen Funkspruchs */
  chainOnly?: boolean;
  choices: ChoiceDef[];
}

const nothing = (text: string): Outcome => ({ text, effects: [] });

export const EVENTS: EventDef[] = [
  // ---- 💰 Händlergilde --------------------------------------------------------
  {
    id: 'g_rabatt', faction: 'gilde', title: 'Sonderangebot!', from: '🤑 Zorg der Händler', hero: '🤑',
    text: 'Zorg hat einen Frachter voller Ersatzteile – „zum Freundschaftspreis“, sagt er und zwinkert mit allen drei Augen.',
    choices: [
      { label: 'Kaufen', cost: { cashSec: 60 }, win: { text: 'Gute Ware! Zorg ist zufrieden.', effects: [{ t: 'res', r: { metal: 900, crystal: 500 } }, { t: 'rep', f: 'gilde', n: 20 }] } },
      {
        label: 'Feilschen', cost: { cashSec: 30 }, chance: 0.6,
        win: { text: 'Zorg seufzt theatralisch – und legt noch eine Kiste drauf.', effects: [{ t: 'res', r: { metal: 1400, crystal: 800 } }, { t: 'rep', f: 'gilde', n: 10 }] },
        lose: { text: '„Beleidigung!“ Zorg verkauft dir nur die Hälfte.', effects: [{ t: 'res', r: { metal: 450 } }, { t: 'rep', f: 'gilde', n: -10 }] },
      },
      { label: 'Ablehnen', win: nothing('Zorg zuckt mit den Schultern. „Dein Verlust, Kommandant.“') },
    ],
  },
  {
    id: 'g_kredit', faction: 'gilde', title: 'Ein Kredit unter Freunden', from: '🤑 Zorg der Händler', hero: '🏦',
    text: 'Die Gilde bietet dir sofort 10 Minuten Einkommen. In einer Stunde möchte sie 15 Minuten zurück – „plus Freundschaft“.',
    choices: [
      { label: 'Annehmen', win: { text: 'Das Geld ist da. Zorg notiert sich etwas.', effects: [{ t: 'cash', sec: 600 }, { t: 'chain', id: 'g_kredit_zahl', min: 60 }] } },
      { label: 'Ablehnen', win: nothing('„Vorsichtig, sehr vorsichtig.“ Zorg nickt anerkennend.') },
    ],
  },
  {
    id: 'g_kredit_zahl', faction: 'gilde', chainOnly: true, title: 'Zahltag', from: '🤑 Zorg der Händler', hero: '🧾',
    text: 'Zorg steht mit einem sehr langen Beleg vor deinem Hangar. Zeit, den Kredit zurückzuzahlen.',
    choices: [
      { label: 'Pünktlich zahlen', cost: { cashSec: 900 }, win: { text: 'Die Gilde merkt sich: Auf dich ist Verlass.', effects: [{ t: 'rep', f: 'gilde', n: 60 }, { t: 'gems', n: 15 }] } },
      { label: 'Vertrösten', win: { text: 'Zorg lächelt dünn. Die Gilde vergisst nie.', effects: [{ t: 'rep', f: 'gilde', n: -80 }] } },
    ],
  },
  {
    id: 'g_auktion', faction: 'gilde', title: 'Galaktische Auktion', from: '💰 Händlergilde', hero: '🔨', minPlanet: 2,
    text: 'Im Auktionshaus von Halcyon kommt ein Artefakt unter den Hammer. Die Gebote steigen schnell.',
    choices: [
      {
        label: 'Mitbieten', cost: { gems: 40 }, chance: 0.65,
        win: { text: 'Zuschlag! Das Artefakt gehört dir.', effects: [{ t: 'artifact', min: 'rare' }, { t: 'rep', f: 'gilde', n: 15 }] },
        lose: { text: 'Überboten in letzter Sekunde. Immerhin gibt es Trostkristalle zurück.', effects: [{ t: 'gems', n: 20 }] },
      },
      { label: 'Alles bieten', cost: { gems: 90 }, win: { text: 'Niemand kann mithalten. Ein besonderes Stück!', effects: [{ t: 'artifact', min: 'epic' }, { t: 'rep', f: 'gilde', n: 25 }] } },
      { label: 'Nur zuschauen', win: nothing('Spannend war es trotzdem.') },
    ],
  },
  {
    id: 'g_schmuggel', faction: 'gilde', title: 'Schmuggelware', from: '📦 Unbekannter Frachter', hero: '🕶️',
    text: 'Ein Frachtkapitän ohne Kennung bietet dir unverzollte Ware an. Die Gilde hätte etwas dagegen.',
    choices: [
      { label: 'Heimlich kaufen', cost: { cashSec: 120 }, win: { text: 'Ein gutes Geschäft – solange es niemand erfährt.', effects: [{ t: 'em', n: 80 }, { t: 'res', r: { deut: 700 } }, { t: 'rep', f: 'gilde', n: -20 }, { t: 'rep', f: 'zyrak', n: 10 }] } },
      { label: 'Der Gilde melden', win: { text: 'Die Gilde bedankt sich mit einer Prämie.', effects: [{ t: 'rep', f: 'gilde', n: 30 }, { t: 'gems', n: 12 }] } },
      { label: 'Ignorieren', win: nothing('Der Frachter verschwindet im Asteroidengürtel.') },
    ],
  },
  {
    id: 'g_messe', faction: 'gilde', title: 'Handelsmesse', from: '💰 Händlergilde', hero: '🎪',
    text: 'Auf der Raumstation Halcyon findet die große Handelsmesse statt. Ein Stand wäre noch frei.',
    choices: [
      { label: 'Stand mieten', cost: { cashSec: 90 }, win: { text: 'Dein Stand ist der Renner der Messe!', effects: [{ t: 'boost', kind: 'income', mult: 2, min: 30 }, { t: 'rep', f: 'gilde', n: 20 }] } },
      { label: 'Nur umsehen', win: { text: 'Du findest ein paar Kristalle in einer Grabbelkiste.', effects: [{ t: 'gems', n: 8 }] } },
    ],
  },
  {
    id: 'g_route', faction: 'gilde', title: 'Zorgs großer Plan', from: '🤑 Zorg der Händler', hero: '🗺️', minPlanet: 4,
    text: 'Zorg will eine Handelsroute bis nach Andromeda eröffnen und sucht Investoren. „Risiko? Kenne ich nicht.“',
    choices: [
      { label: 'Investieren', cost: { cashSec: 600 }, win: { text: 'Zorg reibt sich die Hände. „Du wirst es nicht bereuen!“', effects: [{ t: 'chain', id: 'g_route2', min: 90 }, { t: 'rep', f: 'gilde', n: 10 }] } },
      { label: 'Abwinken', win: nothing('„Feigling!“, ruft Zorg – aber freundlich.') },
    ],
  },
  {
    id: 'g_route2', faction: 'gilde', chainOnly: true, title: 'Die Route steht!', from: '🤑 Zorg der Händler', hero: '🚚',
    text: 'Die ersten Frachter sind auf Zorgs neuer Route unterwegs. Zeit, nachzusehen, was dabei herauskam.',
    choices: [
      {
        label: 'Gewinn abholen', chance: 0.75,
        win: { text: 'Ein voller Erfolg! Die Route bringt ein Vermögen.', effects: [{ t: 'cash', sec: 2400 }, { t: 'rep', f: 'gilde', n: 40 }] },
        lose: { text: 'Piraten haben einen Teil geplündert – aber etwas bleibt übrig.', effects: [{ t: 'cash', sec: 400 }, { t: 'rep', f: 'gilde', n: 15 }] },
      },
    ],
  },
  // ---- 🔬 Akademie der Sterne ----------------------------------------------------
  {
    id: 'a_experiment', faction: 'akademie', title: 'Riskantes Experiment', from: '🧑‍🔬 Professor Plasma', hero: '⚗️',
    text: '„Ich könnte den Ertrag deiner Supernovas verstärken … solange nichts explodiert. Also, nichts Unerwünschtes.“',
    choices: [
      {
        label: 'Finanzieren', cost: { cashSec: 300 }, chance: 0.65,
        win: { text: 'Es funktioniert! Professor Plasma tanzt durchs Labor.', effects: [{ t: 'dust', pct: 0.03 }, { t: 'rep', f: 'akademie', n: 30 }] },
        lose: { text: 'Ein lauter Knall. Das Labor ist schwarz, der Professor auch – aber er lacht.', effects: [{ t: 'rep', f: 'akademie', n: 10 }] },
      },
      { label: 'Lieber nicht', win: nothing('„Wissenschaft braucht Mut“, murmelt der Professor.') },
    ],
  },
  {
    id: 'a_stipendium', faction: 'akademie', title: 'Forschungsstipendium', from: '🔬 Akademie der Sterne', hero: '🎓',
    text: 'Die Akademie sucht Förderer für junge Forscherinnen und Forscher. Dein Name würde auf einer Plakette stehen.',
    choices: [
      { label: 'Kristalle spenden', cost: { gems: 40 }, win: { text: 'Die Akademie ist dir zutiefst dankbar.', effects: [{ t: 'rep', f: 'akademie', n: 45 }, { t: 'xp', frac: 0.4 }] } },
      { label: 'Kristall-Rohstoff spenden', cost: { res: { crystal: 600 } }, win: { text: 'Perfekt für die neuen Laborgeräte!', effects: [{ t: 'rep', f: 'akademie', n: 35 }] } },
      { label: 'Ablehnen', win: nothing('Vielleicht nächstes Mal.') },
    ],
  },
  {
    id: 'a_komet', faction: 'akademie', title: 'Kometen-Studie', from: '🧑‍🔬 Professor Plasma', hero: '🔭',
    text: 'Ein Schwarm goldener Kometen zieht ganz nah vorbei. Mit Sonden könnten wir sie anlocken!',
    choices: [
      { label: 'Sonden starten', cost: { em: 30 }, win: { text: 'Die Sonden locken die Kometen an – schnell antippen!', effects: [{ t: 'comets', n: 3 }, { t: 'rep', f: 'akademie', n: 15 }] } },
      { label: 'Nur beobachten', win: { text: 'Einer kommt trotzdem vorbei.', effects: [{ t: 'comets', n: 1 }] } },
    ],
  },
  {
    id: 'a_zeit', faction: 'akademie', title: 'Zeitanomalie im Labor', from: '🧑‍🔬 Professor Plasma', hero: '⏳', minPlanet: 3,
    text: 'Die Uhren im Labor laufen rückwärts, der Kaffee wird von selbst warm. „Faszinierend“, sagt der Professor.',
    choices: [
      {
        label: 'Untersuchen', chance: 0.55,
        win: { text: 'Du bändigst die Anomalie – deine Anlagen laufen dreimal so schnell!', effects: [{ t: 'boost', kind: 'speed', mult: 3, min: 10 }, { t: 'rep', f: 'akademie', n: 25 }] },
        lose: { text: 'Die Zeit dehnt sich – für ein paar Minuten läuft alles langsamer.', effects: [{ t: 'boost', kind: 'speed', mult: 0.5, min: 5 }, { t: 'rep', f: 'akademie', n: 10 }] },
      },
      { label: 'Abschalten', win: nothing('Die Uhren ticken wieder normal. Schade eigentlich.') },
    ],
  },
  {
    id: 'a_vortrag', faction: 'akademie', title: 'Gastvortrag', from: '🔬 Akademie der Sterne', hero: '🎤',
    text: 'Die Akademie lädt dich zu einem Vortrag über „Supernovas für Fortgeschrittene“ ein.',
    choices: [
      { label: 'Zuhören', win: { text: 'Du lernst eine Menge.', effects: [{ t: 'xp', frac: 0.35 }] } },
      {
        label: 'Selbst vortragen', chance: 0.7,
        win: { text: 'Stehende Ovationen! Die Akademie ist begeistert.', effects: [{ t: 'rep', f: 'akademie', n: 35 }, { t: 'gems', n: 12 }] },
        lose: { text: 'Die Folien waren verkehrt herum. Peinlich – aber sympathisch.', effects: [{ t: 'rep', f: 'akademie', n: 8 }] },
      },
    ],
  },
  {
    id: 'a_horizont', faction: 'akademie', title: 'Expedition zum Ereignishorizont', from: '🧑‍🔬 Professor Plasma', hero: '🕳️', minPlanet: 5,
    text: 'Die Akademie möchte ein Forschungsschiff mit deinen Frachtern zum Ereignishorizont schicken.',
    choices: [
      { label: 'Mitnehmen', win: { text: 'Die Forscher sind unterwegs. Sie melden sich in zwei Stunden.', effects: [{ t: 'chain', id: 'a_horizont2', min: 120 }, { t: 'rep', f: 'akademie', n: 10 }] } },
      { label: 'Ablehnen', win: nothing('Der Professor seufzt und packt seine Instrumente wieder ein.') },
    ],
  },
  {
    id: 'a_horizont2', faction: 'akademie', chainOnly: true, title: 'Rückkehr der Forscher', from: '🧑‍🔬 Professor Plasma', hero: '📊',
    text: 'Die Forscher sind zurück – mit Messdaten und leuchtenden Augen. „Das ändert alles!“',
    choices: [
      { label: 'Daten auswerten', win: { text: 'Die Daten verbessern deine Supernovas deutlich.', effects: [{ t: 'dust', pct: 0.04 }, { t: 'rep', f: 'akademie', n: 45 }] } },
    ],
  },
  // ---- ⚔️ Flottenkommando ------------------------------------------------------
  {
    id: 'f_piraten', faction: 'flotte', title: 'Piratenangriff!', from: '👩‍✈️ Admiralin Vega', hero: '🏴‍☠️',
    text: '„Piraten bedrohen deine Frachter im Asteroidengürtel. Wir können kämpfen – oder zahlen.“',
    choices: [
      {
        label: 'Kämpfen', chance: 0.6,
        win: { text: 'Die Piraten fliehen! In ihrem Wrack findet ihr Beute.', effects: [{ t: 'em', n: 60 }, { t: 'artifact', min: 'common' }, { t: 'rep', f: 'flotte', n: 35 }] },
        lose: { text: 'Die Piraten entkommen mit einem Teil der Ladung.', effects: [{ t: 'em', n: -30 }, { t: 'rep', f: 'flotte', n: 10 }] },
      },
      { label: 'Tribut zahlen', cost: { cashSec: 180 }, win: { text: 'Die Piraten ziehen ab. Vega schaut grimmig.', effects: [{ t: 'rep', f: 'flotte', n: -10 }] } },
      { label: 'Ausweichen', win: nothing('Deine Frachter nehmen einen Umweg. Diesmal ging es gut.') },
    ],
  },
  {
    id: 'f_manoever', faction: 'flotte', title: 'Flottenmanöver', from: '⚔️ Flottenkommando', hero: '🛩️',
    text: 'Das Flottenkommando lädt deine Schiffe zu einem großen Manöver ein. Gute Übung – und gute Kontakte.',
    choices: [
      { label: 'Teilnehmen', win: { text: 'Deine Piloten glänzen!', effects: [{ t: 'rep', f: 'flotte', n: 30 }, { t: 'xp', frac: 0.25 }, { t: 'em', n: 25 }] } },
      { label: 'Absagen', win: { text: 'Vega notiert sich deine Absage.', effects: [{ t: 'rep', f: 'flotte', n: -5 }] } },
    ],
  },
  {
    id: 'f_notruf', faction: 'flotte', title: 'Notruf', from: '📡 Automatisches Notsignal', hero: '🆘',
    text: 'Ein Frachter mit Kolonisten treibt manövrierunfähig im All. Die Luft reicht noch für ein paar Stunden.',
    choices: [
      { label: 'Retten', cost: { em: 40 }, win: { text: 'Alle gerettet! Die Kolonisten wollen für dich arbeiten.', effects: [{ t: 'rep', f: 'flotte', n: 35 }, { t: 'rep', f: 'akademie', n: 10 }, { t: 'gems', n: 15 }] } },
      {
        label: 'Ladung bergen', chance: 0.8,
        win: { text: 'Die Ladung ist wertvoll. Die Flotte findet das gar nicht gut.', effects: [{ t: 'res', r: { metal: 1200, deut: 500 } }, { t: 'rep', f: 'flotte', n: -25 }] },
        lose: { text: 'Die Ladung war leer. Und die Flotte hat es gesehen.', effects: [{ t: 'rep', f: 'flotte', n: -30 }] },
      },
      { label: 'Ignorieren', win: { text: 'Ein anderes Schiff übernimmt. Du hast kein gutes Gefühl.', effects: [{ t: 'rep', f: 'flotte', n: -10 }] } },
    ],
  },
  {
    id: 'f_spion', faction: 'flotte', title: 'Ein Spion an Bord?', from: '👩‍✈️ Admiralin Vega', hero: '🕵️',
    text: 'In deiner Werft verschwinden Baupläne. Vega vermutet einen Spion.',
    choices: [
      {
        label: 'Ermitteln', cost: { cashSec: 60 }, chance: 0.6,
        win: { text: 'Erwischt! Der Spion hatte gestohlene Exotische Materie dabei.', effects: [{ t: 'em', n: 90 }, { t: 'rep', f: 'flotte', n: 25 }] },
        lose: { text: 'Keine Spur. Vielleicht war es nur der Kater.', effects: [] },
      },
      { label: 'Ignorieren', win: nothing('Die Baupläne tauchen nie wieder auf.') },
    ],
  },
  {
    id: 'f_rekrut', faction: 'flotte', title: 'Rekruten', from: '⚔️ Flottenkommando', hero: '🧑‍🚀',
    text: 'Junge Pilotinnen und Piloten möchten in deiner Flotte dienen. Ausbildung kostet – aber lohnt sich.',
    choices: [
      { label: 'Ausbilden', cost: { cashSec: 60 }, win: { text: 'Deine Flotte ist stolz auf den Nachwuchs.', effects: [{ t: 'xp', frac: 0.3 }, { t: 'rep', f: 'flotte', n: 20 }] } },
      { label: 'Zur Flotte schicken', win: { text: 'Vega freut sich über Verstärkung.', effects: [{ t: 'rep', f: 'flotte', n: 25 }] } },
    ],
  },
  // ---- 👽 Zyr'ak-Kollektiv ------------------------------------------------------
  {
    id: 'z_kontakt', faction: 'zyrak', title: 'Erstkontakt', from: '🛸 Unbekanntes Signal', hero: '📶', minPlanet: 2,
    text: 'Eine Folge von Primzahlen. Dann ein Bild – von deinem allerersten Schrottsammler.',
    choices: [
      { label: 'Antworten', win: { text: 'Das Signal verstummt. Dann: „Wir melden uns.“', effects: [{ t: 'rep', f: 'zyrak', n: 30 }, { t: 'chain', id: 'z_kontakt2', min: 20 }] } },
      { label: 'Ignorieren', win: nothing('Das Signal wiederholt sich noch eine Weile, dann ist Stille.') },
    ],
  },
  {
    id: 'z_kontakt2', faction: 'zyrak', chainOnly: true, title: 'Die Stimme der Zyr’ak', from: '🛸 Die Stimme', hero: '👽',
    text: '„Wir haben dich lange beobachtet, Kommandant. Deine Maschinen singen. Sollen wir Geschenke tauschen?“',
    choices: [
      { label: 'Geschenke tauschen', cost: { em: 50 }, win: { text: 'Die Zyr’ak schicken ein schimmerndes Objekt.', effects: [{ t: 'artifact', min: 'rare' }, { t: 'rep', f: 'zyrak', n: 50 }] } },
      { label: 'Misstrauisch bleiben', win: { text: '„Vorsicht ist klug“, sagt die Stimme.', effects: [{ t: 'rep', f: 'zyrak', n: 5 }] } },
    ],
  },
  {
    id: 'z_raetsel', faction: 'zyrak', title: 'Ein Rätsel der Zyr’ak', from: '🛸 Die Stimme', hero: '❓',
    text: '„Was wird größer, je mehr man davon wegnimmt?“',
    choices: [
      { label: 'Ein Loch', win: { text: '„Richtig.“ Ein leises, zufriedenes Summen erfüllt den Funkraum.', effects: [{ t: 'rep', f: 'zyrak', n: 35 }, { t: 'gems', n: 20 }] } },
      { label: 'Das Universum', win: { text: '„Poetisch. Aber falsch.“', effects: [{ t: 'rep', f: 'zyrak', n: 5 }] } },
      { label: 'Mein Schuldenberg', win: { text: 'Die Stimme macht ein Geräusch, das ein Lachen sein könnte.', effects: [{ t: 'rep', f: 'zyrak', n: 15 }] } },
    ],
  },
  {
    id: 'z_handel', faction: 'zyrak', title: 'Fremde Waren', from: '🛸 Die Stimme', hero: '💠',
    text: 'Die Zyr’ak bieten schimmernde Kristalle – im Tausch gegen Exotische Materie.',
    choices: [
      { label: 'Tauschen', cost: { em: 80 }, win: { text: 'Die Kristalle summen leise in deinem Lager.', effects: [{ t: 'res', r: { crystal: 2200 } }, { t: 'rep', f: 'zyrak', n: 20 }] } },
      { label: 'Ablehnen', win: nothing('„Ein andermal.“') },
    ],
  },
  {
    id: 'z_artefakt', faction: 'zyrak', title: 'Leuchtendes Fundstück', from: '👩‍✈️ Admiralin Vega', hero: '🔮', minPlanet: 3,
    text: 'Ein Zyr’ak-Artefakt ist in deinem Gebiet abgestürzt. Vega fragt, ob du es behalten willst.',
    choices: [
      { label: 'Zurückgeben', win: { text: 'Die Zyr’ak sind tief beeindruckt von deiner Ehrlichkeit.', effects: [{ t: 'rep', f: 'zyrak', n: 60 }] } },
      { label: 'Behalten', win: { text: 'Ein mächtiges Stück! Die Zyr’ak sind verstimmt.', effects: [{ t: 'artifact', min: 'epic' }, { t: 'rep', f: 'zyrak', n: -40 }] } },
    ],
  },
  {
    id: 'z_musik', faction: 'zyrak', title: 'Kosmische Musik', from: '🛸 Die Stimme', hero: '🎶',
    text: 'Die Zyr’ak senden ein Lied, bei dem deine Maschinen schneller laufen. Niemand weiß, warum.',
    choices: [
      { label: 'Laut aufdrehen', win: { text: 'Deine Anlagen wippen im Takt – und produzieren doppelt so schnell.', effects: [{ t: 'boost', kind: 'speed', mult: 2, min: 30 }, { t: 'rep', f: 'zyrak', n: 15 }] } },
      { label: 'Aufnehmen und verkaufen', win: { text: 'Ein Hit in der ganzen Galaxie! Die Zyr’ak finden das weniger lustig.', effects: [{ t: 'cash', sec: 300 }, { t: 'rep', f: 'gilde', n: 15 }, { t: 'rep', f: 'zyrak', n: -15 }] } },
    ],
  },
  // ---- Ohne Fraktion: Anomalien, Kolonien, Alltag ---------------------------------
  {
    id: 'n_signal', title: 'Ein seltsames Signal', from: '📡 Funkraum', hero: '🌫️', minPlanet: 6,
    text: 'Aus dem Andromeda-Nebel kommt ein Funkspruch – gesprochen mit deiner eigenen Stimme.',
    choices: [
      { label: 'Zurückfunken', win: { text: 'Stille. Dann: „Endlich. Wir sprechen uns bald.“', effects: [{ t: 'chain', id: 'n_signal2', min: 30 }] } },
      { label: 'Ignorieren', win: nothing('Das Signal verklingt. Ein mulmiges Gefühl bleibt.') },
    ],
  },
  {
    id: 'n_signal2', chainOnly: true, title: 'Antwort aus der Zukunft', from: '📡 Deine eigene Stimme', hero: '🪞',
    text: '„Ich bin du – aus einer anderen Zeitlinie. Ich brauche Exotische Materie, um das Tor offen zu halten.“',
    choices: [
      { label: 'Materie senden', cost: { em: 100 }, win: { text: '„Danke. Warte auf mein Paket.“', effects: [{ t: 'chain', id: 'n_signal3', min: 60 }, { t: 'rep', f: 'akademie', n: 20 }] } },
      { label: 'Ablehnen', win: nothing('„Dann eben nicht“, sagt deine Stimme – und klingt dabei erstaunlich beleidigt.') },
    ],
  },
  {
    id: 'n_signal3', chainOnly: true, title: 'Ein Paket durch die Zeit', from: '📦 Hangar', hero: '🎁',
    text: 'Im Hangar materialisiert sich ein Paket. Auf dem Zettel steht in deiner Handschrift: „Du wirst es brauchen.“',
    choices: [{ label: 'Öffnen', win: { text: 'Ein seltenes Artefakt – und eine Handvoll Kristalle.', effects: [{ t: 'artifact', min: 'epic' }, { t: 'gems', n: 50 }] } }],
  },
  {
    id: 'n_wurmloch', title: 'Wurmloch', from: '🤖 ORAKEL', hero: '🌀', minPlanet: 1,
    text: '„Kommandant, direkt vor dem Hangar hat sich ein Wurmloch geöffnet. Wahrscheinlichkeit, dass das gut ausgeht: interessant.“',
    choices: [
      {
        label: 'Sonde hineinschicken', chance: 0.6,
        win: { text: 'Die Sonde kommt zurück – vollgepackt mit Exotischer Materie!', effects: [{ t: 'em', n: 150 }] },
        lose: { text: 'Die Sonde ist weg. Für immer. Oder bis gestern.', effects: [{ t: 'em', n: -20 }] },
      },
      { label: 'Wieder schließen', win: nothing('ORAKEL: „Weise Entscheidung. Langweilig, aber weise.“') },
    ],
  },
  {
    id: 'n_kometen', title: 'Kometenregen', from: '🤖 ORAKEL', hero: '☄️',
    text: '„Ein Schwarm goldener Kometen nähert sich. Ich empfehle schnelles Antippen.“',
    choices: [{ label: 'Alle Netze raus!', win: { text: 'Da kommen sie!', effects: [{ t: 'comets', n: 4 }] } }],
  },
  {
    id: 'n_schrott', title: 'Riesiger Schrotthaufen', from: '🧑‍🔧 Rusty Rostfrei', hero: '🛰️',
    text: 'Ein ausrangiertes Kriegsschiff treibt an deinen Schrottsammlern vorbei. Rusty bekommt glänzende Augen.',
    choices: [
      { label: 'Ausschlachten', win: { text: 'Tonnenweise Metall – und ein paar exotische Bauteile.', effects: [{ t: 'res', r: { metal: 1800 } }, { t: 'em', n: 30 }] } },
      { label: 'Restaurieren', cost: { em: 60 }, win: { text: 'Das alte Schiff fliegt wieder – als Museum. Die Flotte ist begeistert.', effects: [{ t: 'rep', f: 'flotte', n: 30 }, { t: 'xp', frac: 0.3 }] } },
    ],
  },
  {
    id: 'n_streik', title: 'Streik!', from: '🏭 Betriebsrat', hero: '✊', minPlanet: 1,
    text: 'Die Arbeiter der Mondbasis fordern bessere Algen in der Kantine. Die Produktion steht still.',
    choices: [
      { label: 'Nachgeben', cost: { cashSec: 120 }, win: { text: 'Bessere Algen, bessere Laune: Die Produktion zieht kräftig an!', effects: [{ t: 'boost', kind: 'income', mult: 2, min: 30 }] } },
      {
        label: 'Verhandeln', chance: 0.6,
        win: { text: 'Ein fairer Kompromiss – alle sind motiviert.', effects: [{ t: 'boost', kind: 'income', mult: 1.5, min: 30 }] },
        lose: { text: 'Die Verhandlungen platzen. Eine Weile läuft es schleppend.', effects: [{ t: 'boost', kind: 'income', mult: 0.5, min: 10 }] },
      },
      { label: 'Hart bleiben', win: { text: 'Die Arbeiter gehen murrend zurück an die Arbeit.', effects: [{ t: 'boost', kind: 'income', mult: 0.7, min: 15 }] } },
    ],
  },
  {
    id: 'n_fest', title: 'Galaktisches Fest', from: '🎉 Festkomitee', hero: '🎆',
    text: 'Deine Kolonien feiern den Jahrestag deines Imperiums. Ein Feuerwerk wäre schön …',
    choices: [
      { label: 'Feuerwerk spendieren', cost: { cashSec: 60 }, win: { text: 'Ein Feuerwerk, das man bis Andromeda sieht!', effects: [{ t: 'xp', frac: 0.4 }, { t: 'gems', n: 10 }] } },
      { label: 'Lieber sparen', win: nothing('Es gibt trotzdem Kuchen.') },
    ],
  },
  {
    id: 'n_orakel', title: 'ORAKEL hat eine Idee', from: '🤖 ORAKEL', hero: '🤖',
    text: '„Ich habe deine Produktionspläne optimiert. Darf ich sie hochladen? Ich bin mir zu 85 % sicher.“',
    choices: [
      {
        label: 'Hochladen', chance: 0.85,
        win: { text: '„Optimierung erfolgreich.“ Deine Anlagen laufen doppelt so schnell.', effects: [{ t: 'boost', kind: 'speed', mult: 2, min: 20 }] },
        lose: { text: '„Ups. Komma vergessen.“ Für ein paar Minuten läuft alles langsamer.', effects: [{ t: 'boost', kind: 'speed', mult: 0.5, min: 5 }] },
      },
      { label: 'Lieber nicht', win: nothing('„Wie du meinst.“ ORAKEL klingt gekränkt.') },
    ],
  },
  {
    id: 'n_katze', title: 'Blinder Passagier', from: '📦 Frachtraum', hero: '🐈', weight: 0.6,
    text: 'Im Frachtraum sitzt eine Katze. Niemand weiß, wie sie an Bord kam. Die Crew nennt sie Kommodore Schnurr.',
    choices: [
      { label: 'Behalten', win: { text: 'Kommodore Schnurr übernimmt das Kommando über dein Kissen. Die Moral steigt.', effects: [{ t: 'gems', n: 10 }, { t: 'xp', frac: 0.2 }] } },
      { label: 'Der Akademie geben', win: { text: 'Die Akademie erforscht, wie Katzen durch Wände kommen.', effects: [{ t: 'rep', f: 'akademie', n: 25 }] } },
    ],
  },
  {
    id: 'n_geist', title: 'Geisterschiff', from: '👩‍✈️ Admiralin Vega', hero: '👻', minPlanet: 3,
    text: 'Ein Schiff ohne Besatzung sendet seit 300 Jahren dasselbe Signal: „Nicht öffnen.“',
    choices: [
      {
        label: 'Trotzdem öffnen', chance: 0.55,
        win: { text: 'Drinnen: ein uraltes Artefakt in einer Vitrine.', effects: [{ t: 'artifact', min: 'rare' }] },
        lose: { text: 'Das Schiff hatte recht. Ihr verliert etwas Materie bei der Flucht.', effects: [{ t: 'em', n: -40 }] },
      },
      { label: 'In die Sonne lenken', win: { text: 'Manche Geheimnisse bleiben besser ungelöst. Vega nickt zufrieden.', effects: [{ t: 'rep', f: 'flotte', n: 15 }] } },
    ],
  },
  {
    id: 'n_supernova', title: 'Ferne Supernova', from: '🔭 Sternwarte', hero: '💥', minPlanet: 2,
    text: 'In der Nachbarschaft explodiert ein Stern. Die Staubwolke zieht genau an dir vorbei.',
    choices: [
      { label: 'Staub einsammeln', cost: { em: 40 }, win: { text: 'Feinster Sternenstaub!', effects: [{ t: 'dust', pct: 0.02 }] } },
      { label: 'Einfach genießen', win: { text: 'Was für ein Anblick.', effects: [{ t: 'xp', frac: 0.2 }] } },
    ],
  },
  {
    id: 'n_touristen', title: 'Weltraumtouristen', from: '🧳 Reisebüro Sternenblick', hero: '📸', minPlanet: 2,
    text: 'Eine Reisegruppe möchte deine Anlagen besichtigen. Sie haben sehr große Kameras.',
    choices: [
      { label: 'Führung anbieten', win: { text: 'Die Gruppe ist begeistert und spendet großzügig.', effects: [{ t: 'cash', sec: 240 }, { t: 'rep', f: 'gilde', n: 10 }] } },
      {
        label: 'Teuren Eintritt verlangen', chance: 0.7,
        win: { text: 'Sie zahlen – und kaufen noch Souvenirs!', effects: [{ t: 'cash', sec: 600 }] },
        lose: { text: 'Eine schlechte Bewertung im Galaxie-Netz. Autsch.', effects: [{ t: 'rep', f: 'gilde', n: -10 }] },
      },
    ],
  },
  {
    id: 'n_hoehle', title: 'Kristallhöhle', from: '⛏️ Bergbauteam', hero: '💎', minPlanet: 5,
    text: 'Auf dem Saturn wurde eine Höhle voller funkelnder Kristalle entdeckt.',
    choices: [
      { label: 'Alles abbauen', win: { text: 'Dein Lager glitzert.', effects: [{ t: 'res', r: { crystal: 2500 } }] } },
      { label: 'Der Akademie melden', win: { text: 'Die Akademie forscht – und teilt mit dir.', effects: [{ t: 'rep', f: 'akademie', n: 30 }, { t: 'res', r: { crystal: 800 } }] } },
    ],
  },
  {
    id: 'n_energie', title: 'Energieüberschuss', from: '⚡ Kraftwerksleitung', hero: '🔋', minPlanet: 1,
    text: 'Deine Kraftwerke laufen heute heiß. Was tun mit der überschüssigen Energie?',
    choices: [
      { label: 'In Chips stecken', win: { text: 'Die Chipfabriken laufen auf Hochtouren.', effects: [{ t: 'res', r: { chips: 250 } }] } },
      { label: 'Ins Netz einspeisen', win: { text: 'Die Stromrechnung der Nachbarn zahlt sich aus.', effects: [{ t: 'cash', sec: 300 }] } },
    ],
  },
  {
    id: 'n_rusty', title: 'Ein alter Bekannter', from: '🧑‍🔧 Rusty Rostfrei', hero: '☕',
    text: 'Rusty Rostfrei, dein allererster Manager, meldet sich aus dem Ruhestand. „Na, Chef, wie läuft der Laden?“',
    choices: [
      { label: 'Zum Kaffee einladen', win: { text: 'Rusty erzählt Geschichten von früher. Du lernst etwas dabei.', effects: [{ t: 'xp', frac: 0.5 }] } },
      { label: 'Um Rat fragen', win: { text: '„Mehr Magneten!“, sagt Rusty. Er hat recht.', effects: [{ t: 'boost', kind: 'speed', mult: 2, min: 15 }] } },
    ],
  },
  {
    id: 'n_meteor', title: 'Meteoritenschauer', from: '🪐 Kolonie Mars', hero: '🌠', minPlanet: 2,
    text: 'Meteoriten prasseln auf die Mars-Kolonie. Einige sind voller Erz!',
    choices: [
      {
        label: 'Einschläge abbauen', chance: 0.75,
        win: { text: 'Ein Volltreffer – im besten Sinne.', effects: [{ t: 'res', r: { metal: 2200, crystal: 400 } }] },
        lose: { text: 'Nur Staub und Steine.', effects: [{ t: 'res', r: { metal: 200 } }] },
      },
      { label: 'In Deckung gehen', win: nothing('Sicher ist sicher.') },
    ],
  },
];

export const EVENT_INDEX: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
