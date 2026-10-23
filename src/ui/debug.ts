// Test-Werkzeuge, nur mit ?debug=1 sichtbar
import { PLANETS } from '../data/planets';
import { earn, timeWarp } from '../core/actions';
import { compute, earningsForDust } from '../core/economy';
import { fmt } from '../core/format';
import { G } from './ctx';
import { h } from './dom';
import { showModal } from './modal';
import { toast } from './fx';
import { spawnComet } from './comets';

export function initDebug(root: HTMLElement): void {
  const btn = h('button', { class: 'debug-btn', 'aria-label': 'Debug' }, '🐞');
  btn.addEventListener('click', open);
  root.appendChild(btn);
}

function open(): void {
  const s = () => G.s;
  const act = (label: string, fn: () => void) => ({
    label,
    cls: 'ghost',
    onClick: () => {
      fn();
      G.dirty = true;
      return false;
    },
  });
  showModal({
    hero: '🐞',
    title: 'Debug',
    body: 'Werkzeuge zum Testen.',
    actions: [
      act('💰 Geld ×1000 (mind. 1 Mio)', () => {
        const amt = Math.max(1e6, s().cash * 1000);
        earn(s(), amt);
        toast('💰', '+' + fmt(amt));
      }),
      act('⏩ 1 h vorspulen', () => void timeWarp(s(), 1, Date.now())),
      act('💎 +500 Kristalle', () => { s().gems += 500; }),
      act('✨ Supernova bereit (+12 ✨)', () => {
        const need = earningsForDust(s(), 12);
        earn(s(), Math.max(0, need - s().runEarnings) * 1.01);
      }),
      act('✨ +1000 Sternenstaub', () => {
        s().stardust += 1000;
        s().stardustEarned += 1000;
        s().stardustLifetime += 1000;
      }),
      {
        label: '☄️ Komet jetzt',
        cls: 'ghost',
        onClick: () => {
          setTimeout(() => spawnComet(), 350);
        },
      },
      act('🌙 Offline-Test (3 h zurück)', () => {
        s().lastActive = Date.now() - 3 * 3600 * 1000;
      }),
      act('🕳️ Zum Galaxiekern', () => {
        const last = PLANETS.length - 1;
        s().stardustEarned = Math.max(s().stardustEarned, PLANETS[last].need * 4);
        s().planet = last;
        compute(s(), Date.now(), G.calc);
      }),
      act('📅 Tägliche Belohnung zurücksetzen', () => { s().daily.last = ''; }),
      { label: 'Schließen', cls: 'violet' },
    ],
  });
}
