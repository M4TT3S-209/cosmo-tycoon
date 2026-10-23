export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ArtifactEffectKind =
  | 'income' | 'bld' | 'offline' | 'offcap' | 'comet' | 'cometLuck' | 'gems' | 'dust'
  | 'discount' | 'speed' | 'expSpeed' | 'expLoot' | 'expSuccess' | 'em';

export interface ArtifactDef {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  kind: ArtifactEffectKind;
  /** Anlagen-Index bei kind 'bld' */
  b?: number;
  /** Wirkung pro Stufe */
  v: number;
  flavor: string;
}

export const ARTIFACT_MAX_LEVEL = 10;

export const RARITY: Record<Rarity, { name: string; color: string; emValue: number }> = {
  common: { name: 'Gewöhnlich', color: '#a5b1c9', emValue: 15 },
  rare: { name: 'Selten', color: '#4fa8ff', emValue: 40 },
  epic: { name: 'Episch', color: '#c084fc', emValue: 120 },
  legendary: { name: 'Legendär', color: '#ffc94d', emValue: 400 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const ARTIFACTS: ArtifactDef[] = [
  // Gewöhnlich
  { id: 'greifer', name: 'Rostiger Greifer', emoji: '🦾', rarity: 'common', kind: 'bld', b: 0, v: 0.25, flavor: 'Hat schon tausend Satelliten gefangen.' },
  { id: 'bohrkopf', name: 'Uralter Bohrkopf', emoji: '⛏️', rarity: 'common', kind: 'bld', b: 1, v: 0.2, flavor: 'Diamantbesetzt. Leicht angeschlagen.' },
  { id: 'antenne', name: 'Verbogene Antenne', emoji: '📡', rarity: 'common', kind: 'bld', b: 2, v: 0.2, flavor: 'Empfängt sogar Alien-Radio.' },
  { id: 'solarsplitter', name: 'Solarsplitter', emoji: '🔆', rarity: 'common', kind: 'bld', b: 3, v: 0.2, flavor: 'Ein Stück eingefangenes Sonnenlicht.' },
  { id: 'sternkarte', name: 'Alte Sternkarte', emoji: '🗺️', rarity: 'common', kind: 'expSpeed', v: 0.03, flavor: 'Kennt Abkürzungen durch den Hyperraum.' },
  { id: 'kristallstaub', name: 'Kristallstaub', emoji: '💠', rarity: 'common', kind: 'gems', v: 0.03, flavor: 'Funkelt verdächtig wertvoll.' },
  { id: 'thermos', name: 'Kosmische Thermoskanne', emoji: '☕', rarity: 'common', kind: 'offline', v: 0.02, flavor: 'Hält deine Manager auch nachts wach.' },
  { id: 'meteorit', name: 'Glücksmeteorit', emoji: '🌠', rarity: 'common', kind: 'comet', v: 0.03, flavor: 'Zieht Kometen magisch an.' },
  // Selten
  { id: 'plasmazelle', name: 'Plasmazelle', emoji: '🔋', rarity: 'rare', kind: 'bld', b: 4, v: 0.3, flavor: 'Summt leise vor sich hin.' },
  { id: 'raketenduese', name: 'Raketendüse', emoji: '🔥', rarity: 'rare', kind: 'bld', b: 5, v: 0.3, flavor: 'Noch warm vom letzten Start.' },
  { id: 'mondstein', name: 'Mondstein', emoji: '🌙', rarity: 'rare', kind: 'bld', b: 6, v: 0.3, flavor: 'Leuchtet in der Nacht.' },
  { id: 'frachtmanifest', name: 'Frachtmanifest', emoji: '📦', rarity: 'rare', kind: 'expLoot', v: 0.05, flavor: 'Laut Liste passt immer noch was rein.' },
  { id: 'schildkern', name: 'Schildkern', emoji: '🛡️', rarity: 'rare', kind: 'expSuccess', v: 0.015, flavor: 'Hält Asteroiden und Steuerprüfer fern.' },
  { id: 'zahnrad', name: 'Präzisions-Zahnrad', emoji: '⚙️', rarity: 'rare', kind: 'speed', v: 0.03, flavor: 'Läuft seit 10.000 Jahren ohne Öl.' },
  { id: 'goldbarren', name: 'Weltraum-Goldbarren', emoji: '🥇', rarity: 'rare', kind: 'discount', v: 0.015, flavor: 'Lässt jeden Händler freundlicher werden.' },
  // Episch
  { id: 'aliencore', name: 'Alien-Datenkern', emoji: '👾', rarity: 'epic', kind: 'bld', b: 7, v: 0.5, flavor: 'Enthält 40 Zettabyte Handelsgeheimnisse.' },
  { id: 'dysonspiegel', name: 'Dyson-Spiegel', emoji: '🪞', rarity: 'epic', kind: 'bld', b: 8, v: 0.5, flavor: 'Reflektiert eine ganze Sonne.' },
  { id: 'zeitkristall', name: 'Zeitkristall', emoji: '⏳', rarity: 'epic', kind: 'offcap', v: 1, flavor: 'Dehnt die Zeit, während du schläfst.' },
  { id: 'nebelflasche', name: 'Nebel in der Flasche', emoji: '🧴', rarity: 'epic', kind: 'dust', v: 0.03, flavor: 'Ein kleiner Sternennebel zum Mitnehmen.' },
  { id: 'kometenherz', name: 'Kometenherz', emoji: '☄️', rarity: 'epic', kind: 'cometLuck', v: 0.15, flavor: 'Der glühende Kern eines goldenen Kometen.' },
  { id: 'katalysator', name: 'EM-Katalysator', emoji: '⚗️', rarity: 'epic', kind: 'em', v: 0.08, flavor: 'Verdichtet Exotische Materie.' },
  // Legendär
  { id: 'schwarzesjuwel', name: 'Schwarzes Juwel', emoji: '🖤', rarity: 'legendary', kind: 'income', v: 0.1, flavor: 'Absorbiert Licht – und verdoppelt Gewinne.' },
  { id: 'singularitaet', name: 'Taschen-Singularität', emoji: '🕳️', rarity: 'legendary', kind: 'bld', b: 9, v: 1, flavor: 'Bitte nicht in die Hosentasche stecken.' },
  { id: 'urknall', name: 'Fragment des Urknalls', emoji: '💥', rarity: 'legendary', kind: 'dust', v: 0.05, flavor: 'Ein Splitter vom Anfang aller Dinge.' },
];

export const ARTIFACT_INDEX: Record<string, ArtifactDef> = Object.fromEntries(ARTIFACTS.map((a) => [a.id, a]));
