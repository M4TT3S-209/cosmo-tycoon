// Kopfzeile (Geld, Einkommen, Kristalle, Boosts) und Tab-Leiste
import { PLANETS } from '../data/planets';
import { fmt, fmtClock } from '../core/format';
import { canClaimDaily } from '../core/meta';
import { xpForNext } from '../core/rank';
import { abilityReadyIn, abilityUnlocked, useAbility } from '../core/commander';
import { ABILITY_INDEX } from '../data/talents';
import { toast } from './fx';
import { openNextEvent } from './events';
import { G, openTab, onTabChange, type TabId } from './ctx';
import { h, setText, setClass, sphereEl, clear } from './dom';
import { sfx, haptic } from '../audio/sfx';

let cashEl: HTMLElement;
let incomeEl: HTMLElement;
let gemsEl: HTMLElement;
let dustChip: HTMLElement;
let dustEl: HTMLElement;
let planetChip: HTMLElement;
let planetName: HTMLElement;
let planetMini: HTMLElement | null = null;
let questBadge: HTMLElement;
let rankLevel: HTMLElement;
let rankRing: HTMLElement;
let boostBox: HTMLElement;
let abilityBar: HTMLElement;
let eventChip: HTMLElement;
let eventCount: HTMLElement;
let abilityKey = '';
const abilityBtns: { id: string; el: HTMLElement }[] = [];
let shownCash = 0;
let lastPlanet = -1;
let boostKey = '';
const boostTimers: { el: HTMLElement; id: string }[] = [];

export function buildHud(): HTMLElement {
  cashEl = h('div', { class: 'cash num' }, '0');
  incomeEl = h('div', { class: 'income num' }, '');
  gemsEl = h('span', { class: 'num' }, '0');
  dustEl = h('span', { class: 'num' }, '0');
  planetName = h('span', null, '');
  questBadge = h('span', { class: 'badge' });
  rankLevel = h('span', { class: 'num' }, '1');
  rankRing = h('span', { class: 'rank-ring' }, '⭐');
  boostBox = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
  abilityBar = h('div', { class: 'ability-bar' });
  eventCount = h('b', { class: 'num' }, '');
  eventChip = h('button', { class: 'event-chip', 'aria-label': 'Funksprüche', onClick: () => { sfx.click(); haptic(); openNextEvent(); } }, '📡 ', eventCount);

  planetChip = h('button', { class: 'chip', onClick: () => go('kosmos', 'planeten') }, planetName);
  dustChip = h('button', { class: 'chip dust', onClick: () => go('kosmos', 'nova') }, '✨', dustEl);
  const questChip = h('button', { class: 'chip rank-chip', 'aria-label': 'Rang und Ziele', onClick: () => go('mehr', 'missionen') }, rankRing, rankLevel, questBadge);
  const gemChip = h('button', { class: 'chip gems', onClick: () => go('mehr', 'shop') }, '💎', gemsEl);

  return h(
    'header',
    { class: 'hud' },
    h('div', { class: 'hud-top' }, planetChip, dustChip, questChip, gemChip),
    h('div', { class: 'hud-cash' }, h('span', { class: 'coin' }, '¢'), cashEl),
    h('div', { class: 'hud-sub' }, incomeEl, boostBox, h('div', { class: 'hud-right' }, eventChip, abilityBar)),
  );
}

function go(tab: TabId, sub: string): void {
  sfx.click();
  haptic();
  openTab(tab, sub);
}

export function bumpCash(): void {
  cashEl.classList.remove('bump');
  void cashEl.offsetWidth;
  cashEl.classList.add('bump');
}

export function updateHud(dt: number): void {
  const s = G.s;
  // Geld zählt sanft hoch, fällt aber sofort
  if (s.cash < shownCash || shownCash <= 0) shownCash = s.cash;
  else shownCash += (s.cash - shownCash) * Math.min(1, dt * 12);
  setText(cashEl, fmt(shownCash, false));
  const inc = G.calc.income;
  setText(incomeEl, inc > 0 ? `+${fmt(inc)} /s` : 'Tippe deine Anlagen an!');
  setText(gemsEl, fmt(s.gems, false));
  setText(rankLevel, String(s.rank.level));
  rankRing.style.setProperty('--p', String(Math.min(1, s.rank.xp / xpForNext(s.rank.level))));
  setText(dustEl, fmt(s.stardust, false));
  dustChip.style.display = s.stardustLifetime > 0 ? '' : 'none';

  if (s.planet !== lastPlanet) {
    lastPlanet = s.planet;
    const p = PLANETS[s.planet];
    planetMini?.remove();
    planetMini = sphereEl(p, 'mini-sphere');
    planetChip.insertBefore(planetMini, planetName);
    setText(planetName, p.name);
  }

  // Missionen-Badge
  const claimable = s.quests.filter((q) => q.done).length + (canClaimDaily(s, G.now) ? 1 : 0);
  setText(questBadge, String(claimable));
  setClass(questBadge, 'on', claimable > 0);

  // Boost-Chips
  const active = s.boosts.filter((b) => b.until > G.now);
  const key = active.map((b) => b.id).join(',');
  if (key !== boostKey) {
    boostKey = key;
    clear(boostBox);
    boostTimers.length = 0;
    for (const b of active) {
      const t = h('span', { class: 'num' }, '');
      boostBox.appendChild(h('span', { class: 'boost-chip' + (b.kind === 'speed' ? ' speed' : '') }, b.icon, `×${b.mult}`, t));
      boostTimers.push({ el: t, id: b.id });
    }
  }
  for (const bt of boostTimers) {
    const b = active.find((x) => x.id === bt.id);
    if (b) setText(bt.el, fmtClock((b.until - G.now) / 1000));
  }
  // abgelaufene Boosts aufräumen
  if (s.boosts.length !== active.length) s.boosts = active;

  updateAbilityBar();
  const waiting = s.events.queue.length;
  eventChip.style.display = waiting ? '' : 'none';
  setText(eventCount, String(waiting));
}

// ---- Fähigkeiten-Leiste --------------------------------------------------------

function updateAbilityBar(): void {
  const s = G.s;
  const ids = s.commander.abilities.filter((id) => ABILITY_INDEX[id] && abilityUnlocked(s, ABILITY_INDEX[id]));
  const key = ids.join(',');
  if (key !== abilityKey) {
    abilityKey = key;
    clear(abilityBar);
    abilityBtns.length = 0;
    for (const id of ids) {
      const a = ABILITY_INDEX[id];
      const el = h('button', { class: 'ability-btn', 'aria-label': a.name }, a.emoji);
      el.addEventListener('click', () => {
        const left = abilityReadyIn(G.s, id, Date.now());
        if (left > 0) {
          sfx.error();
          toast(a.emoji, a.name, `Bereit in ${fmtClock(left)}`);
          return;
        }
        const r = useAbility(G.s, id, Date.now());
        if (r.ok) {
          sfx.claim();
          haptic();
          toast(a.emoji, a.name + '!', r.text, true);
        } else {
          sfx.error();
          toast(a.emoji, a.name, r.text);
        }
      });
      abilityBar.appendChild(el);
      abilityBtns.push({ id, el });
    }
  }
  for (const b of abilityBtns) {
    const a = ABILITY_INDEX[b.id];
    const left = abilityReadyIn(s, b.id, G.now);
    b.el.style.setProperty('--cd', String(Math.min(1, left / a.cooldown)));
    setClass(b.el, 'ready', left <= 0);
  }
}

// ---- Tab-Leiste ------------------------------------------------------------

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'imperium', icon: '🏭', label: 'Imperium' },
  { id: 'flotte', icon: '🚀', label: 'Flotte' },
  { id: 'kolonien', icon: '🪐', label: 'Kolonien' },
  { id: 'kosmos', icon: '🌟', label: 'Kosmos' },
  { id: 'kommandant', icon: '👤', label: 'Kommando' },
  { id: 'mehr', icon: '☰', label: 'Mehr' },
];
const tabEls: Record<string, { btn: HTMLElement; badge: HTMLElement }> = {};

export function buildTabbar(): HTMLElement {
  const bar = h('nav', { class: 'tabbar' });
  for (const t of TABS) {
    const badge = h('span', { class: 'badge dot' });
    const btn = h('button', { class: 'tab', 'data-tab': t.id }, h('span', { class: 'ti' }, t.icon), t.label, badge);
    btn.addEventListener('click', () => {
      sfx.click();
      haptic();
      if (G.tab === t.id) {
        document.getElementById('screen')?.scrollTo({ top: 0, behavior: 'smooth' });
      }
      openTab(t.id);
    });
    tabEls[t.id] = { btn, badge };
    bar.appendChild(btn);
  }
  onTabChange(markTabs);
  markTabs(G.tab);
  return bar;
}

function markTabs(tab: TabId): void {
  for (const t of TABS) setClass(tabEls[t.id].btn, 'on', t.id === tab);
}

export function setTabBadge(tab: TabId, on: boolean): void {
  setClass(tabEls[tab].badge, 'on', on);
}

export function tabButton(tab: TabId): HTMLElement {
  return tabEls[tab].btn;
}
