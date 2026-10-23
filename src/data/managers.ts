export interface ManagerDef {
  building: number;
  name: string;
  emoji: string;
  cost: number;
  quote: string;
}

export const MANAGERS: ManagerDef[] = [
  { building: 0, name: 'Rusty Rostfrei', emoji: '🧑‍🔧', cost: 1e3, quote: 'Ein Mann, ein Magnet.' },
  { building: 1, name: 'Käpt’n Krater', emoji: '👷', cost: 1.5e4, quote: 'Tiefer! Immer tiefer!' },
  { building: 2, name: 'Sputnik-Sam', emoji: '🧑‍💻', cost: 1e5, quote: 'Ping? Profit.' },
  { building: 3, name: 'Solara Sonnenschein', emoji: '😎', cost: 5e5, quote: 'Sonnenbrille ist Pflicht.' },
  { building: 4, name: 'Professor Plasma', emoji: '🧑‍🔬', cost: 1.2e6, quote: 'Nicht anfassen. Glüht.' },
  { building: 5, name: 'Rocket Rita', emoji: '👩‍🚀', cost: 1e7, quote: '3… 2… 1… Cash!' },
  { building: 6, name: 'Luna Lux', emoji: '🧑‍🚀', cost: 1.11e8, quote: 'Ich sehe immer die helle Seite.' },
  { building: 7, name: 'Zorg der Händler', emoji: '🤑', cost: 5.55e8, quote: 'Zorg macht dir gutes Angebot.' },
  { building: 8, name: 'Ingenieurin Dyson', emoji: '🦾', cost: 1e10, quote: 'Eine Sonne reicht nicht.' },
  { building: 9, name: 'Mr. Singularität', emoji: '🧙', cost: 1e11, quote: 'Die Zeit ist relativ. Gewinn nicht.' },
];
