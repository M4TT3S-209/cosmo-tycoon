import { BUILDINGS, BUILDING_COUNT } from '../../data/buildings';
import { buyBuilding, tapBuilding } from '../../core/actions';
import {
  buildingBlocked, buildingCost, buyAmount, empireMultPer, isManaged, minOwned, nextEmpireMilestone, nextMilestone,
  planetTrait, prevMilestone,
} from '../../core/economy';
import { fmt, fmtClock, fmtTime } from '../../core/format';
import { autoOptions, autoStatus } from '../../core/autobuy';
import type { BuyMode } from '../../core/state';
import { CHALLENGE_INDEX } from '../../data/challenges';
import { countdownLeft } from '../../core/challenges';
import { G, openTab } from '../ctx';
import { h, pressRepeat, setClass, setScale, setText, clear } from '../dom';
import { burstAt, floatAt } from '../fx';
import { sfx, haptic } from '../../audio/sfx';
import type { Screen } from './types';

interface CardRefs {
  i: number;
  card: HTMLElement;
  icon: HTMLElement;
  lvl: HTMLElement;
  mgr: HTMLElement;
  per: HTMLElement;
  bar: HTMLElement;
  fill: HTMLElement;
  rev: HTMLElement;
  time: HTMLElement;
  msText: HTMLElement;
  msFill: HTMLElement;
  buy: HTMLElement;
  amt: HTMLElement;
  cost: HTMLElement;
  locked: boolean;
}

const MODES: { mode: BuyMode; label: string }[] = [
  { mode: 1, label: '×1' },
  { mode: 10, label: '×10' },
  { mode: 100, label: '×100' },
  { mode: 0, label: 'Ziel' },
  { mode: -1, label: 'Max' },
];

export function createAnlagen(): Screen {
  const el = h('div', { class: 'screen' });
  let cards: CardRefs[] = [];
  const modeBtns: HTMLElement[] = [];
  const acc = new Array<number>(BUILDING_COUNT).fill(0);
  const accT = new Array<number>(BUILDING_COUNT).fill(0);
  let empText: HTMLElement;
  let chalText: HTMLElement | null = null;
  let chalFill: HTMLElement | null = null;
  let empFill: HTMLElement;
  let autoText: HTMLElement;
  let lastErr = 0;

  function cardFor(i: number): CardRefs {
    const d = BUILDINGS[i];
    const s = G.s;
    const locked = s.buildings[i].owned === 0;
    const lvl = h('span', { class: 'lvl num' }, '0');
    const mgr = h('span', { class: 'mgr' }, '👔');
    const icon = h('button', { class: 'bld-icon', 'aria-label': d.name }, d.emoji, lvl, mgr);
    const per = h('span', { class: 'per num' }, '');
    const fill = h('div', { class: 'fill' });
    const rev = h('span', { class: 'num' }, '');
    const time = h('span', { class: 't num' }, '');
    const bar = h('div', { class: 'bar' }, fill, h('div', { class: 'bar-text' }, rev, time));
    const msText = h('div', { class: 'num' }, '');
    const msFill = h('i');
    const amt = h('span', { class: 'amt num' }, '');
    const cost = h('span', { class: 'cost num' }, '');
    const buy = h('button', { class: 'btn buy' }, amt, cost);
    const card = h(
      'div',
      { class: 'card bld' + (locked ? ' locked-card' : ''), 'data-b': i },
      icon,
      h('div', { class: 'col', style: 'gap:6px' },
        h('div', { class: 'bld-head' },
          h('span', { class: 'title' }, d.name),
          planetTrait(s)?.bld?.[i] ? h('span', { class: 'trait-tag' }, `🪐×${planetTrait(s)!.bld![i]}`) : null,
          per,
        ),
        locked ? h('div', { class: 'sub' }, d.flavor) : bar,
      ),
      h('div', { class: 'bld-bottom', style: 'grid-column: 2' },
        h('div', { class: 'ms' }, msText, h('div', { class: 'mini' }, msFill)),
        buy,
      ),
    );
    card.style.setProperty('--c', d.color);
    if (locked) {
      lvl.style.display = 'none';
      mgr.style.display = 'none';
    }

    const tap = () => {
      if (tapBuilding(G.s, i)) {
        sfx.tap();
        haptic();
        burstAt(icon, d.color, 6, 'spark', 0.6);
      }
    };
    icon.addEventListener('click', tap);
    bar.addEventListener('click', tap);
    pressRepeat(buy, () => {
      const mode = G.s.buildings[i].owned === 0 ? 1 : G.s.settings.buyMode;
      if (buyBuilding(G.s, i, mode)) {
        sfx.buy();
        haptic();
        burstAt(buy, '#ffd166', 8, 'coin', 0.7);
      } else if (performance.now() - lastErr > 400) {
        lastErr = performance.now();
        sfx.error();
      }
    });
    return { i, card, icon, lvl, mgr, per, bar, fill, rev, time, msText, msFill, buy, amt, cost, locked };
  }

  function build(): void {
    clear(el);
    cards = [];
    modeBtns.length = 0;
    const seg = h('div', { class: 'seg' });
    for (const m of MODES) {
      const b = h('button', null, m.label);
      b.addEventListener('click', () => {
        G.s.settings.buyMode = m.mode;
        sfx.click();
        haptic();
        markModes();
      });
      modeBtns.push(b);
      seg.appendChild(b);
    }
    el.appendChild(h('div', { class: 'sticky' }, h('div', { class: 'buybar' }, seg)));
    markModes();

    // laufende Prüfung als Banner
    const ch = G.s.challenge.active ? CHALLENGE_INDEX[G.s.challenge.active] : null;
    if (ch) {
      chalText = h('div', { class: 'sub num' }, '');
      chalFill = h('i');
      const banner = h('button', { class: 'card chal-banner' },
        h('div', { class: 'row' },
          h('span', { style: 'font-size:24px' }, ch.emoji),
          h('div', { class: 'col', style: 'text-align:left' },
            h('div', { class: 'title' }, `Prüfung: ${ch.name}`),
            h('div', { class: 'progress', style: 'margin-top:2px' }, chalFill),
            chalText,
          ),
        ),
      );
      banner.addEventListener('click', () => openTab('kosmos', 'pruefung'));
      el.appendChild(banner);
    } else {
      chalText = null;
      chalFill = null;
    }

    empText = h('div', { class: 'sub num', style: 'font-weight:700' }, '');
    empFill = h('i');
    autoText = h('div', { class: 'sub num auto-status' }, '');
    el.appendChild(h('div', { class: 'card empire' }, empText, h('div', { class: 'progress', style: 'margin-top:6px' }, empFill), autoText));

    const s = G.s;
    let shownLocked = false;
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const owned = s.buildings[i].owned > 0;
      if (!owned) {
        if (shownLocked) {
          el.appendChild(h('div', { class: 'card teaser' }, '🔒 Weitere Anlagen warten im All …'));
          break;
        }
        shownLocked = true;
      }
      const c = cardFor(i);
      cards.push(c);
      el.appendChild(c.card);
    }
  }

  function markModes(): void {
    MODES.forEach((m, idx) => setClass(modeBtns[idx], 'on', G.s.settings.buyMode === m.mode));
  }

  function update(dt: number): void {
    const s = G.s;
    const c = G.calc;
    const out = G.out;

    if (chalText && chalFill) {
      if (!s.challenge.active) G.dirty = true;
      else {
        setScale(chalFill, s.runEarnings / s.challenge.goal);
        let t = `${fmt(s.runEarnings)} / ${fmt(s.challenge.goal)}`;
        if (s.challenge.active === 'countdown') t += ` · ⏱ ${fmtClock(countdownLeft(s))}`;
        setText(chalText, t);
      }
    }

    // Imperium-Meilenstein
    const allUnlocked = s.buildings.every((b) => b.owned > 0);
    if (!allUnlocked) {
      const n = s.buildings.filter((b) => b.owned > 0).length;
      setText(empText, `🏆 Schalte alle 10 Anlagen frei für Imperium-Boni (${n}/10)`);
      setScale(empFill, n / 10);
    } else {
      const next = nextEmpireMilestone(s);
      const m = minOwned(s);
      if (next === null) {
        setText(empText, '🏆 Alle Imperium-Meilensteine erreicht!');
        setScale(empFill, 1);
      } else {
        setText(empText, `🏆 Alle Anlagen auf ${next} → gesamter Ertrag ×${String(empireMultPer(s)).replace('.', ',')}  (${m}/${next})`);
        setScale(empFill, m / next);
      }
    }

    // Auto-Käufer: worauf er gerade hinarbeitet (Zeile bleibt stehen, damit nichts springt)
    const autoOn = !!autoOptions(s)?.buildings;
    autoText.style.display = autoOn ? '' : 'none';
    if (autoOn) {
      const tgt = autoStatus.target;
      if (tgt && tgt.eta >= 2 && Number.isFinite(tgt.eta)) {
        const eta = tgt.eta < 3600 ? fmtClock(tgt.eta) : fmtTime(tgt.eta);
        setText(autoText, tgt.saving ? `🤖 Noch ${eta} sparen für ${tgt.label}` : `🤖 Noch ${eta} bis ${tgt.label}`);
      } else setText(autoText, '🤖 Auto-Käufer kauft laufend, was sich am meisten lohnt');
    }

    for (const r of cards) {
      const i = r.i;
      const b = s.buildings[i];
      if (buildingBlocked(s, i)) {
        setText(r.amt, 'Gesperrt');
        setText(r.cost, '🔒 Prüfung');
        setClass(r.buy, 'off', true);
        setClass(r.card, 'locked', true);
        continue;
      }
      setClass(r.card, 'locked', false);
      if (r.locked) {
        if (b.owned > 0) {
          G.dirty = true;
          continue;
        }
        const cost = buildingCost(s, i, 1);
        setText(r.amt, 'Freischalten');
        setText(r.cost, fmt(cost));
        setClass(r.buy, 'off', cost > s.cash);
        setText(r.msText, '');
        continue;
      }
      const t = c.time[i];
      const managed = isManaged(s, i);
      setText(r.lvl, String(b.owned));
      r.mgr.style.display = managed ? '' : 'none';
      const fast = t < 0.3 && (managed || b.running);
      setClass(r.bar, 'fast', fast);
      if (!fast) setScale(r.fill, managed || b.running ? b.progress : 0);
      setText(r.rev, '+' + fmt(c.rev[i]));
      const remaining = managed || b.running ? (1 - b.progress) * t : t;
      setText(r.time, t < 1 ? `${(Math.max(0, remaining)).toFixed(1).replace('.', ',')} s` : fmtClock(remaining));
      setText(r.per, managed ? `${fmt(c.rev[i] / t)}/s` : '');
      setClass(r.icon, 'idle', !managed && !b.running);

      const next = nextMilestone(b.owned);
      if (next === null) {
        setText(r.msText, '⭐ Alle Meilensteine');
        setScale(r.msFill, 1);
      } else {
        const prev = prevMilestone(b.owned);
        setText(r.msText, `⭐ ${b.owned}/${next} · ⚡×2`);
        setScale(r.msFill, (b.owned - prev) / (next - prev));
      }

      const n = buyAmount(s, i, s.settings.buyMode);
      const cost = buildingCost(s, i, n);
      setText(r.amt, `Kaufen ×${n}`);
      setText(r.cost, fmt(cost));
      setClass(r.buy, 'off', cost > s.cash);

      // Einnahmen-Effekte
      if (out.cycles[i] > 0) {
        acc[i] += out.earned[i];
        if (t >= 0.45) {
          floatAt(r.bar, '+' + fmt(acc[i]), '#ffd166');
          if (!managed || t >= 3) sfx.coin(i);
          if (!managed) burstAt(r.icon, '#ffd166', 5, 'coin', 0.5);
          acc[i] = 0;
          accT[i] = 0;
        }
      }
      if (acc[i] > 0 && t < 0.45) {
        accT[i] += dt;
        if (accT[i] >= 1.2) {
          floatAt(r.bar, '+' + fmt(acc[i]), '#ffd166');
          acc[i] = 0;
          accT[i] = 0;
        }
      }
    }
  }

  return { el, build, update, title: 'Anlagen' };
}

/** Karte einer Anlage hervorheben (Meilenstein) */
export function flashBuilding(i: number): void {
  const card = document.querySelector(`.bld[data-b="${i}"]`);
  if (!card) return;
  card.classList.remove('flash');
  void (card as HTMLElement).offsetWidth;
  card.classList.add('flash');
  burstAt(card, BUILDINGS[i].color, 24, 'spark', 1.2);
}
