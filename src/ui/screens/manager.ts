import { BUILDINGS } from '../../data/buildings';
import { MANAGERS } from '../../data/managers';
import { hireManager } from '../../core/actions';
import { fmt } from '../../core/format';
import { lab } from '../../core/economy';
import { G } from '../ctx';
import { h, setClass, clear } from '../dom';
import { burstAt } from '../fx';
import { sfx, haptic } from '../../audio/sfx';
import type { Screen } from './types';

export function createManager(): Screen {
  const el = h('div', { class: 'screen' });
  let rows: { i: number; btn: HTMLElement }[] = [];

  function build(): void {
    clear(el);
    rows = [];
    const s = G.s;
    const hired = s.managers.filter(Boolean).length;
    el.appendChild(
      h('div', { class: 'card' },
        h('div', { class: 'title' }, `👔 Manager (${hired}/10)`),
        h('div', { class: 'sub', style: 'margin-top:4px' },
          'Manager starten die Produktion automatisch – auch während du offline bist. ',
          lab(s, 'keepmgr') ? '🧠 Dank Manager-Gedächtnis bleiben sie nach einer Supernova.' : 'Nach einer Supernova kündigen sie (außer mit 🧠 Manager-Gedächtnis aus dem Labor).',
        ),
      ),
    );
    MANAGERS.forEach((m, i) => {
      const b = BUILDINGS[i];
      const owned = s.buildings[i].owned > 0;
      const isHired = s.managers[i];
      let right: HTMLElement;
      if (isHired) right = h('span', { class: 'owned-tag' }, '✓ Im Dienst');
      else if (!owned) right = h('span', { class: 'tag' }, '🔒 ' + b.emoji);
      else {
        const btn = h('button', { class: 'btn small' }, h('span', { class: 'cost num' }, h('span', { class: 'coin small' }, '¢'), fmt(m.cost)));
        btn.addEventListener('click', () => {
          if (hireManager(G.s, i)) {
            sfx.manager();
            haptic();
            burstAt(btn, b.color, 24, 'spark', 1);
          } else sfx.error();
        });
        rows.push({ i, btn });
        right = btn;
      }
      const card = h('div', { class: 'card mgr-card' + (isHired ? ' glow' : '') + (!owned ? ' locked' : '') },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round' }, m.emoji),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, m.name),
            h('div', { class: 'sub' }, `${b.emoji} ${owned ? 'Leitet ' + b.name : 'Benötigt ' + b.name}`),
            h('div', { class: 'quote' }, `„${m.quote}“`),
          ),
          right,
        ),
      );
      card.style.setProperty('--c', b.color);
      el.appendChild(card);
    });
  }

  function update(): void {
    for (const r of rows) setClass(r.btn, 'off', MANAGERS[r.i].cost > G.s.cash);
  }

  return { el, build, update, title: 'Manager' };
}

export function managerBadge(): boolean {
  const s = G.s;
  return MANAGERS.some((m, i) => !s.managers[i] && s.buildings[i].owned > 0 && m.cost <= s.cash);
}

