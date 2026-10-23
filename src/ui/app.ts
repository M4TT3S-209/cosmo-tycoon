// Baut die Oberfläche auf und verbindet Spiel-Events mit Effekten
import { BUILDINGS } from '../data/buildings';
import { PLANETS, PLANET_MULT } from '../data/planets';
import { on } from '../core/bus';
import { fmt, fmtTime, setNotation } from '../core/format';
import { canClaimDaily, claimDaily, nextDailyDay, type OfflineResult, applyOffline } from '../core/meta';
import { saveGame } from '../core/save';
import { G, onTabChange, openTab, type TabId } from './ctx';
import { clear, h, sphereEl } from './dom';
import { burst, flash, initFx, shake, toast, updateFx } from './fx';
import { buildHud, buildTabbar, setTabBadge, updateHud } from './hud';
import { initModals, showModal } from './modal';
import { initStarfield, starWarp, updateStarfield } from './starfield';
import { initComets, spawnComet, updateComets } from './comets';
import { initTutorial, updateTutorial } from './tutorial';
import { createAnlagen, flashBuilding } from './screens/anlagen';
import { createManager, managerBadge } from './screens/manager';
import { createUpgrades, upgradeBadge } from './screens/upgrades';
import { createKosmos, kosmosBadge } from './screens/kosmos';
import { createMehr, setReplaceHandler } from './screens/mehr';
import type { Screen } from './screens/types';
import { DAILY } from '../data/daily';
import { sfx, haptic, setHaptics, setMusic, setSound } from '../audio/sfx';

let screenBox: HTMLElement;
let screens: Record<TabId, Screen>;
let current: Screen | null = null;
let planetBg: HTMLElement;
let appEl: HTMLElement;
let badgeTimer = 0;
let shownPlanet = -1;

export function buildApp(root: HTMLElement): void {
  appEl = root;
  clear(root);
  const stars = h('canvas', { id: 'stars' });
  planetBg = h('div', { class: 'planet-bg' });
  screenBox = h('main', { id: 'screen' });
  const shell = h('div', { id: 'shell' }, buildHud(), screenBox, buildTabbar());
  root.append(stars, h('div', { class: 'bg-clip' }, planetBg), shell);
  initStarfield(stars);
  initFx(root, shell);
  initComets(root);
  initModals(root);
  initTutorial(root);

  screens = {
    anlagen: createAnlagen(),
    manager: createManager(),
    upgrades: createUpgrades(),
    kosmos: createKosmos(),
    mehr: createMehr(),
  };
  onTabChange(() => {
    G.dirty = true;
    screenBox.scrollTop = 0;
  });
  setReplaceHandler(() => applySettings());
  applySettings();
  wireEvents();
}

/** Nach Laden/Import/Reset: Einstellungen und Theme übernehmen */
export function applySettings(): void {
  const st = G.s.settings;
  setNotation(st.notation);
  setSound(st.sound);
  setMusic(st.music);
  setHaptics(st.haptics);
  shownPlanet = -1;
  G.dirty = true;
}

function applyPlanetTheme(): void {
  if (shownPlanet === G.s.planet) return;
  shownPlanet = G.s.planet;
  const p = PLANETS[G.s.planet];
  appEl.style.setProperty('--nebula-a', p.nebula[0]);
  appEl.style.setProperty('--nebula-b', p.nebula[1]);
  appEl.style.setProperty('--glow', p.glow);
  clear(planetBg);
  const sp = sphereEl(p);
  sp.style.width = '100%';
  sp.style.height = '100%';
  planetBg.appendChild(sp);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#060818');
}

export function frameUi(dt: number): void {
  applyPlanetTheme();
  if (G.dirty || current !== screens[G.tab]) {
    G.dirty = false;
    const next = screens[G.tab];
    if (current !== next) {
      clear(screenBox);
      screenBox.appendChild(next.el);
      current = next;
      next.el.classList.remove('enter');
      void next.el.offsetWidth;
      next.el.classList.add('enter');
    }
    const y = screenBox.scrollTop;
    next.build();
    screenBox.scrollTop = y;
  }
  current!.update(dt);
  updateHud(dt);
  updateStarfield(dt);
  updateFx(dt);
  updateComets(dt);
  updateTutorial(dt);
  if (G.out.cometSpawn && !spawnComet()) G.s.nextCometIn = 8;

  badgeTimer += dt;
  if (badgeTimer > 0.3) {
    badgeTimer = 0;
    setTabBadge('manager', managerBadge());
    setTabBadge('upgrades', upgradeBadge());
    setTabBadge('kosmos', kosmosBadge());
    setTabBadge('mehr', G.s.quests.some((q) => q.done) || canClaimDaily(G.s, G.now));
  }
}

function wireEvents(): void {
  on('structure', () => {
    G.dirty = true;
  });
  on('milestone', ({ building, level }) => {
    sfx.milestone();
    haptic();
    flashBuilding(building);
    toast(BUILDINGS[building].emoji, `${BUILDINGS[building].name}: Tempo ×2!`, `Meilenstein ${level} erreicht`);
  });
  on('empire', ({ mult }) => {
    sfx.milestone();
    haptic();
    burst(window.innerWidth / 2, 140, '#ffd166', 40, 'spark', 1.4);
    toast('🏆', 'Imperium-Meilenstein!', `Gesamter Ertrag ×${String(mult).replace('.', ',')}`, true);
  });
  on('achievement', ({ def }) => {
    sfx.achievement();
    toast(def.emoji, `Erfolg: ${def.name}`, `+${def.gems} 💎 · +1 % Einkommen`, true, 3200);
  });
  on('questDone', () => {
    toast('🎯', 'Mission erfüllt!', 'Hol dir deine Kristalle unter 🎯 ab.');
  });
  on('timewarp', ({ amount, hours }) => {
    toast('⏩', `Zeitsprung ${hours} h`, `+${fmt(amount)} 🪙`, true);
  });
  on('supernova', ({ gain, planetChanged, planet }) => {
    sfx.supernova();
    flash(true);
    shake();
    starWarp(2.2);
    haptic();
    saveGame(G.s);
    setTimeout(() => {
      burst(window.innerWidth / 2, window.innerHeight * 0.45, '#f0abfc', 80, 'spark', 2.2);
      if (planetChanged) planetReveal(planet);
      else toast('💥', `Supernova! +${fmt(gain, false)} ✨`, 'Dein Imperium ist stärker als je zuvor.', true, 3500);
    }, 900);
    openTab('anlagen');
  });
  on('galaxy', ({ gain }) => {
    sfx.galaxy();
    flash(true);
    shake();
    starWarp(4);
    saveGame(G.s);
    setTimeout(() => {
      showModal({
        hero: '⚛️',
        title: 'Willkommen in einer neuen Galaxie!',
        body: [`Du hast <b class="q-c">+${gain} Quantenkerne</b> erhalten. Investiere sie unter Kosmos → Galaxie in mächtige Quanten-Perks.`],
        actions: [{ label: '🌌 Weiter', cls: 'cyan' }],
      });
    }, 1400);
    openTab('anlagen');
  });
}

function planetReveal(i: number): void {
  const p = PLANETS[i];
  const sp = sphereEl(p);
  sp.style.width = '120px';
  sp.style.height = '120px';
  sp.style.margin = '6px auto 14px';
  showModal({
    title: `Ankunft: ${p.name}!`,
    body: [sp, `<div style="text-align:center">${p.desc}<br><b class="good-c">Neuer Planeten-Bonus: ×${String(Math.pow(PLANET_MULT, i).toFixed(2)).replace(/\.?0+$/, '').replace('.', ',')} Einkommen</b></div>`],
    actions: [{ label: '🚀 Auf geht’s!', cls: 'violet' }],
  });
}

// ---- Willkommens-Dialoge -----------------------------------------------------

export function offlineDialog(r: OfflineResult): void {
  const cost = 10;
  showModal({
    hero: '🌙',
    title: 'Willkommen zurück!',
    body: [
      `Du warst <b>${fmtTime(r.seconds)}</b> weg. Deine Manager haben in der Zeit gearbeitet:`,
      `<div class="big-num gold-c num" style="text-align:center;margin:10px 0">+${fmt(r.amount)}</div>`,
      r.capped ? `<span class="hint">Offline-Speicher voll nach ${fmtTime(r.counted)} – erweitere ihn im Labor (🔋).</span>` : '',
    ].filter(Boolean),
    actions: [
      {
        label: `✨ ×2 kassieren (${cost} 💎)`,
        cls: 'cyan',
        onClick: () => {
          if (G.s.gems < cost) {
            sfx.error();
            toast('💎', 'Nicht genug Kristalle');
            return false;
          }
          G.s.gems -= cost;
          applyOffline(G.s, r, 2);
          sfx.claim();
          burst(window.innerWidth / 2, window.innerHeight * 0.6, '#ffd166', 40, 'coin', 1.4);
        },
      },
      {
        label: '💰 Einsammeln',
        cls: '',
        onClick: () => {
          applyOffline(G.s, r, 1);
          sfx.claim();
          burst(window.innerWidth / 2, window.innerHeight * 0.6, '#ffd166', 24, 'coin', 1.2);
        },
      },
    ],
    dismissable: false,
  });
}

export function dailyDialog(): void {
  const s = G.s;
  if (!canClaimDaily(s, Date.now())) return;
  const day = nextDailyDay(s, Date.now());
  const r = DAILY[day - 1];
  showModal({
    hero: '🎁',
    title: `Tägliche Belohnung – Tag ${day}`,
    body: [`Schön, dass du da bist! Heute gibt es: <b>${r.emoji} ${r.label}</b>`, 'Komm jeden Tag wieder – an Tag 7 wartet ein großer Bonus!'],
    actions: [
      {
        label: '🎁 Abholen',
        cls: '',
        onClick: () => {
          const res = claimDaily(G.s, Date.now());
          if (res) {
            sfx.claim();
            burst(window.innerWidth / 2, window.innerHeight * 0.6, '#ffd166', 30, 'coin', 1.2);
          }
        },
      },
    ],
  });
}
