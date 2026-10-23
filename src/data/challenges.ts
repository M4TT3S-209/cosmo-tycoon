export interface ChallengeDef {
  id: string;
  name: string;
  emoji: string;
  rule: string;
  reward: (tier: number) => string;
  /** Lauf-Einnahmen-Ziel je Stufe (1–5) */
  goals: number[];
}

export const CHALLENGE_TIERS = 5;
export const CHALLENGE_UNLOCK_SUPERNOVAS = 3;
export const COUNTDOWN_SECONDS = 600;

const STD = [1e10, 1e17, 1e26, 1e38, 1e54];

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'nomgr', name: 'Ohne Manager', emoji: '🚫', rule: 'Manager arbeiten nicht – alles muss angetippt werden.',
    reward: (t) => `+${t * 25} % Einkommen`, goals: [1e8, 1e13, 1e20, 1e30, 1e44],
  },
  {
    id: 'inflation', name: 'Inflation', emoji: '💸', rule: 'Alle Anlagen kosten das Zehnfache.',
    reward: (t) => `−${t * 3} % Baukosten`, goals: STD,
  },
  {
    id: 'slow', name: 'Zeitlupe', emoji: '🐢', rule: 'Alle Zyklen laufen 10× langsamer.',
    reward: (t) => `+${t * 20} % Tempo`, goals: STD,
  },
  {
    id: 'five', name: 'Nur 5 Anlagen', emoji: '5️⃣', rule: 'Anlagen 6–10 sind gesperrt.',
    reward: (t) => `Anlagen 6–10 ×${String(Math.pow(1.5, t).toFixed(2)).replace(/\.?0+$/, '').replace('.', ',')}`, goals: [1e9, 1e15, 1e23, 1e34, 1e48],
  },
  {
    id: 'noupg', name: 'Ohne Upgrades', emoji: '⬆️', rule: 'Upgrades können nicht gekauft werden.',
    reward: (t) => `Jedes Imperium-Protokoll +${t * 2} % stärker`, goals: [1e9, 1e15, 1e23, 1e34, 1e48],
  },
  {
    id: 'storm', name: 'Kometensturm', emoji: '☄️', rule: 'Einkommen ×0,1 – dafür kommt alle 20 s ein Komet.',
    reward: (t) => `Kometen-Beute +${t * 50} %`, goals: STD,
  },
  {
    id: 'dark', name: 'Dunkle Materie', emoji: '🌑', rule: 'Dein Sternenstaub-Bonus ist ausgeschaltet.',
    reward: (t) => `+${t * 5} % Sternenstaub`, goals: STD,
  },
  {
    id: 'countdown', name: 'Countdown', emoji: '⏱️', rule: 'Erreiche das Ziel in 10 Minuten.',
    reward: (t) => (t <= 1 ? '+1 Hangar-Platz' : `+1 Hangar-Platz, +${(t - 1) * 2} h Offline-Dauer`), goals: [1e9, 1e15, 1e23, 1e34, 1e48],
  },
];

export const CHALLENGE_INDEX: Record<string, ChallengeDef> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
