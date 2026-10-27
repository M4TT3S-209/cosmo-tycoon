import { BUILDINGS } from '../../data/buildings';
import { UPGRADES } from '../../data/upgrades';
import { buyAllUpgrades, buyUpgrade } from '../../core/actions';
import { fmt } from '../../core/format';
import { upgradeCost } from '../../core/economy';
import { G } from '../ctx';
import { h, setClass, setText, clear } from '../dom';
import { burstAt, toast } from '../fx';
import { sfx, haptic } from '../../audio/sfx';
import type { Screen } from './types';

const SHOW = 25;

export function createUpgrades(): Screen {
  const el = h('div', { class: 'screen' });
  let rows: { cost: number; btn: HTMLElement }[] = [];
  let allBtn: HTMLElement;
  let allLabel: HTMLElement;

  function build(): void {
    clear(el);
    rows = [];
    const s = G.s;
    const bought = UPGRADES.filter((u) => s.upgrades[u.id]).length;
    allLabel = h('span', null, 'Alle kaufen');
    allBtn = h('button', { class: 'btn small green' }, allLabel);
    allBtn.addEventListener('click', () => {
      const n = buyAllUpgrades(G.s);
      if (n > 0) {
        sfx.upgrade();
        haptic();
        toast('⬆️', `${n} Upgrade${n > 1 ? 's' : ''} gekauft`);
      } else sfx.error();
    });
    el.appendChild(
      h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('div', { class: 'col' },
            h('div', { class: 'title' }, `⬆️ Upgrades (${bought}/${UPGRADES.length})`),
            h('div', { class: 'sub' }, 'Jedes Upgrade verdreifacht den Ertrag. Imperium-Protokolle wirken auf alle Anlagen.'),
          ),
          allBtn,
        ),
      ),
    );
    const open = UPGRADES.filter((u) => !s.upgrades[u.id]).slice(0, SHOW);
    if (!open.length) {
      el.appendChild(h('div', { class: 'empty' }, '🎉 Alle Upgrades gekauft! Zeit für eine Supernova.'));
      return;
    }
    for (const u of open) {
      const b = u.target >= 0 ? BUILDINGS[u.target] : null;
      const locked = b !== null && s.buildings[u.target].owned === 0;
      const cost = upgradeCost(s, u);
      const btn = h('button', { class: 'btn small' }, h('span', { class: 'cost num' }, h('span', { class: 'coin small' }, '¢'), fmt(cost)));
      btn.addEventListener('click', () => {
        if (buyUpgrade(G.s, u.id)) {
          sfx.upgrade();
          haptic();
          burstAt(btn, b?.color ?? '#a78bfa', 22, 'spark', 1);
        } else sfx.error();
      });
      rows.push({ cost, btn });
      const card = h('div', { class: 'card' + (locked ? ' locked' : '') + (b ? '' : ' glow') },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round' }, b ? b.emoji : '🌐'),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, u.name),
            h('div', { class: 'sub' }, b ? `${b.name}: Ertrag ×${u.mult}` : `Alle Anlagen: Ertrag ×${u.mult}`),
          ),
          btn,
        ),
      );
      card.style.setProperty('--c', b?.color ?? '#a78bfa');
      el.appendChild(card);
    }
    const remaining = UPGRADES.length - bought - open.length;
    if (remaining > 0) el.appendChild(h('div', { class: 'card teaser' }, `🔒 ${remaining} weitere Upgrades folgen …`));
  }

  function update(): void {
    let affordable = 0;
    let sum = 0;
    for (const u of UPGRADES) {
      if (G.s.upgrades[u.id]) continue;
      const cost = upgradeCost(G.s, u);
      if (sum + cost > G.s.cash) break;
      sum += cost;
      affordable++;
    }
    setText(allLabel, affordable ? `Alle kaufen (${affordable})` : 'Alle kaufen');
    setClass(allBtn, 'off', affordable === 0);
    for (const r of rows) setClass(r.btn, 'off', r.cost > G.s.cash);
  }

  return { el, build, update, title: 'Upgrades' };
}

export function upgradeBadge(): boolean {
  const next = UPGRADES.find((u) => !G.s.upgrades[u.id]);
  return !!next && upgradeCost(G.s, next) <= G.s.cash;
}
