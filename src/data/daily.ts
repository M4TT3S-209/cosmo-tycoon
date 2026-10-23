export interface DailyReward {
  gems?: number;
  /** Boost-ID aus dem Shop */
  boost?: 'x2' | 'turbo';
  /** Zeitsprung in Stunden */
  warp?: number;
  label: string;
  emoji: string;
}

export const DAILY: DailyReward[] = [
  { gems: 5, label: '5 Kristalle', emoji: '💎' },
  { boost: 'x2', label: 'Boost ×2 (30 min)', emoji: '🔥' },
  { gems: 10, label: '10 Kristalle', emoji: '💎' },
  { warp: 1, label: 'Zeitsprung 1 h', emoji: '⏩' },
  { gems: 15, label: '15 Kristalle', emoji: '💎' },
  { boost: 'turbo', label: 'Turbo ×5 (5 min)', emoji: '🚀' },
  { gems: 40, warp: 4, label: '40 💎 + Zeitsprung 4 h', emoji: '🎁' },
];
