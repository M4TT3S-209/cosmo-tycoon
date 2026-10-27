// Baut die Oberfläche auf und verbindet Spiel-Events mit Effekten
import { BUILDINGS } from '../data/buildings';
import { PLANETS, PLANET_MULT } from '../data/planets';
import { on } from '../core/bus';
import { fmt, fmtTime, setNotation } from '../core/format';
import { canClaimDaily, claimDaily, nextDailyDay } from '../core/meta';
import { earn } from '../core/actions';
import type { OfflineSummary } from '../core/offline';
import { readyMissions } from '../core/fleet';
import { rankTitle } from '../core/rank';
import { CHALLENGE_INDEX } from '../data/challenges';
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
import { createGroup } from './screens/group';
import { createKolonien, koloniesBadge } from './screens/kolonien';
import { createKommandant, kommandantBadge } from './screens/kommandant';
import { onTabOpened, tabIsNew } from './tour';
import { announceEvent } from './events';
import { FACTION_INDEX, REP_NAMES } from '../data/factions';
import { COLONY_BUILDING_INDEX, RES_META } from '../data/colonies';
import { MEGA_INDEX } from '../data/megaprojects';
import { RES_IDS } from '../core/colonies';
import { weeklyClaimable, weeklyContract, weeklyMod } from '../core/weekly';
import { createManager, managerBadge } from './screens/manager';
import { createUpgrades, upgradeBadge } from './screens/upgrades';
import { createKosmos, kosmosBadge } from './screens/kosmos';
import { createMehr, setReplaceHandler } from './screens/mehr';
import { createFlotte, flotteBadge } from './screens/flotte';
import type { Screen } from './screens/types';
import { DAILY } from '../data/daily';
import { sfx, haptic, setHaptics, setIgnoreMute, setMusic, setSound } from '../audio/sfx';

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
    imperium: createGroup('imperium', 'Imperium', [
      { id: 'anlagen', label: '🏭 Anlagen', screen: createAnlagen() },
      { id: 'manager', label: '👔 Manager', screen: createManager(), badge: managerBadge },
      { id: 'upgrades', label: '⬆️ Upgrades', screen: createUpgrades(), badge: upgradeBadge },
    ]),
    flotte: createFlotte(),
    kolonien: createKolonien(),
    kosmos: createKosmos(),
    kommandant: createKommandant(),
    mehr: createMehr(),
  };
  onTabChange((tab) => {
    G.dirty = true;
    screenBox.scrollTop = 0;
    onTabOpened(tab);
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
  setIgnoreMute(st.ignoreMute);
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
  flushPending();
  updateHud(dt);
  updateStarfield(dt);
  updateFx(dt);
  updateComets(dt);
  updateTutorial(dt);
  if (G.out.cometSpawn && !spawnComet()) G.s.nextCometIn = 8;

  badgeTimer += dt;
  if (badgeTimer > 0.3) {
    badgeTimer = 0;
    setTabBadge('imperium', managerBadge() || upgradeBadge());
    setTabBadge('kosmos', kosmosBadge());
    setTabBadge('flotte', flotteBadge());
    setTabBadge('kolonien', tabIsNew('kolonien') || koloniesBadge());
    setTabBadge('kommandant', tabIsNew('kommandant') || kommandantBadge());
    setTabBadge('mehr', G.s.quests.some((q) => q.done) || canClaimDaily(G.s, G.now) || weeklyClaimable(G.s));
  }
}

function wireEvents(): void {
  on('structure', () => {
    G.dirty = true;
  });
  // Meilensteine, Imperium und Rang werden gebündelt gemeldet (der Auto-Käufer kauft oft viele auf einmal)
  on('milestone', (m) => pending.milestones.push(m));
  on('empire', (e) => {
    pending.empire = e;
    pending.empireCount++;
  });
  on('achievement', ({ def }) => {
    sfx.achievement();
    toast(def.emoji, `Erfolg: ${def.name}`, `+${def.gems} 💎 · +1 % Einkommen`, true, 3200);
  });
  on('questDone', () => {
    toast('🎯', 'Mission erfüllt!', 'Hol dir deine Kristalle unter 🎯 ab.');
  });
  on('timewarp', ({ amount, hours }) => {
    if (hours < 1) return;
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
    openTab('imperium', 'anlagen');
  });
  on('rankUp', ({ level, gems }) => {
    if (!pending.rank) pending.rank = { from: level - 1, to: level, gems: 0 };
    pending.rank.to = level;
    pending.rank.gems += gems;
  });
  on('challengeDone', ({ id, tier }) => {
    const c = CHALLENGE_INDEX[id];
    sfx.milestone();
    flash(false);
    saveGame(G.s);
    showModal({
      hero: '🏅',
      title: `Prüfung bestanden: ${c.name}!`,
      body: [`Stufe ${tier} von 5 geschafft. Deine dauerhafte Belohnung: <b class="good-c">${c.reward(tier)}</b>.`, 'Dein Lauf geht ganz normal weiter – ohne Einschränkung.'],
      actions: [{ label: '🎉 Weiter', cls: 'green' }],
    });
  });
  on('eventArrived', ({ id }) => announceEvent(id));
  on('factionUp', ({ faction, level }) => {
    const f = FACTION_INDEX[faction];
    sfx.achievement();
    haptic();
    toast(f.emoji, `${f.name}: ${REP_NAMES[level]}!`, `Neuer Vorteil: ${f.perks[level - 1]}`, true, 4500);
  });
  on('colonyBuilt', ({ planet, id, level }) => {
    const where = `Kolonie ${PLANETS[planet]?.name ?? ''}`;
    sfx.upgrade();
    if (!id) toast('🏙️', `${where}: Stufe ${level}`, '+1 Bauplatz und +10 % Produktion', true, 4000);
    else {
      const d = COLONY_BUILDING_INDEX[id];
      toast(d?.emoji ?? '🏗️', `${d?.name ?? id} Stufe ${level} fertig`, where);
    }
  });
  on('megaDone', ({ id, stage }) => {
    const m = MEGA_INDEX[id];
    if (!m) return;
    sfx.achievement();
    haptic();
    flash(false);
    showModal({
      hero: m.emoji,
      title: `${m.name}: Stufe ${stage}!`,
      body: [`<div style="text-align:center"><b>${m.stages[stage - 1]}</b></div>`, stage < m.stages.length ? `<span class="hint">Nächste Stufe: ${m.stages[stage]}</span>` : '<span class="hint">Voll ausgebaut – ein Wunder des Universums!</span>'],
      actions: [{ label: '🎉 Großartig', cls: 'violet' }],
    });
  });
  on('weeklyNew', () => {
    const m = weeklyMod(G.s);
    const c = weeklyContract(G.s);
    if (!m) return;
    sfx.achievement();
    toast(m.emoji, `Neue Woche: ${m.name}`, `${m.desc}${c ? ` Sonderauftrag: ${c.text} (Mehr → Ziele).` : ''}`, true, 6000);
  });
  on('cometShower', ({ n }) => {
    for (let k = 0; k < n; k++) setTimeout(() => spawnComet(), 400 + k * 900);
  });
  on('numberCap', () => {
    toast('🛡️', 'Zahlen-Schutz', 'Dein Geld hat die größte Zahl erreicht, mit der das Spiel rechnen kann (1e300). Supernova und Galaxie-Sprung bringen dich weiter.', true, 6000);
  });
  on('challengeFailed', ({ id }) => {
    toast('⏱️', `${CHALLENGE_INDEX[id].name}: Zeit abgelaufen`, 'Die Prüfung ist vorbei – dein Lauf geht normal weiter.', false, 4000);
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
    openTab('imperium', 'anlagen');
  });
}

const pending = {
  milestones: [] as { building: number; level: number }[],
  empire: null as { level: number; mult: number } | null,
  empireCount: 0,
  rank: null as { from: number; to: number; gems: number } | null,
};
let lastMilestoneFx = 0;

/** Gesammelte Meldungen ausgeben: höchstens ein Ton und ein Toast je Art */
function flushPending(): void {
  const now = performance.now();
  if (pending.empire) {
    const { mult } = pending.empire;
    const more = pending.empireCount > 1 ? ` (${pending.empireCount}×)` : '';
    sfx.milestone();
    haptic();
    burst(window.innerWidth / 2, 140, '#ffd166', 40, 'spark', 1.4);
    toast('🏆', `Imperium-Meilenstein!${more}`, `Gesamter Ertrag ×${String(mult).replace('.', ',')}`, true);
    pending.empire = null;
    pending.empireCount = 0;
    lastMilestoneFx = now;
  }
  // einzelne Meilensteine höchstens alle 1,2 s melden, dazwischen sammeln
  if (pending.milestones.length && now - lastMilestoneFx > 1200) {
    const list = pending.milestones;
    const last = list[list.length - 1];
    const b = BUILDINGS[last.building];
    sfx.milestone();
    haptic();
    for (const i of new Set(list.map((m) => m.building))) flashBuilding(i);
    const more = list.length - 1;
    toast(b.emoji, `${b.name}: Tempo ×2!`, more > 0 ? `Meilenstein ${last.level} · +${more} weitere Meilensteine` : `Meilenstein ${last.level} erreicht`);
    list.length = 0;
    lastMilestoneFx = now;
  }
  if (pending.rank) {
    const { from, to, gems } = pending.rank;
    sfx.achievement();
    haptic();
    const newTitle = Math.floor((to - 1) / 10) > Math.floor((from - 1) / 10);
    const title = newTitle ? `Neuer Rang: ${rankTitle(to)}!` : to - from > 1 ? `Kommandanten-Level ${to}! (+${to - from})` : `Kommandanten-Level ${to}!`;
    toast('⭐', title, `+${gems} 💎 · +${to - from} % Einkommen`, true, 3200);
    pending.rank = null;
  }
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

/** Zusammenfassung der Offline-Zeit (Geld, Käufe und Supernovas sind bereits verbucht) */
export function offlineDialog(r: OfflineSummary): void {
  const cost = 10;
  const center = (html: string) => `<div class="sub" style="text-align:center">${html}</div>`;
  const auto: string[] = [];
  if (r.bought) auto.push(`🤖 ${fmt(r.bought, false)} Anlagen`);
  if (r.upgrades) auto.push(`🛠️ ${r.upgrades} Upgrade${r.upgrades === 1 ? '' : 's'}`);
  if (r.managers) auto.push(`👔 ${r.managers} Manager`);
  const lines: string[] = [];
  if (auto.length) lines.push(center(auto.join(' · ') + ' gekauft'));
  if (r.supernovas) {
    lines.push(center(`💥 <b>${r.supernovas} Supernova${r.supernovas === 1 ? '' : 's'}</b> ausgelöst: <b class="dust-c">+${fmt(r.stardust, false)} ✨</b>`));
  }
  if (r.planetAfter > r.planetBefore) lines.push(center(`🪐 Neuer Planet: <b>${PLANETS[r.planetAfter].name}</b>`));
  if (r.pendingAfter >= 1 && r.pendingAfter !== r.pendingBefore) {
    lines.push(center(r.supernovas
      ? `✨ Nächste Supernova bringt schon +${fmt(r.pendingAfter, false)} ✨`
      : `✨ Supernova bringt jetzt +${fmt(r.pendingAfter, false)} ✨ (vorher +${fmt(r.pendingBefore, false)})`));
  }
  for (const [id, tier] of r.challenges) lines.push(center(`🏅 Prüfung bestanden: <b>${CHALLENGE_INDEX[id].name}</b> (Stufe ${tier})`));
  for (const id of r.failed) lines.push(center(`⏱️ ${CHALLENGE_INDEX[id].name}: Zeit abgelaufen`));
  if (r.rankAfter > r.rankBefore) lines.push(center(`⭐ Kommandanten-Level ${r.rankBefore} → ${r.rankAfter}`));
  const ready = readyMissions(G.s, Date.now());
  if (ready) lines.push(center(`🚀 ${ready} Expedition${ready === 1 ? '' : 'en'} zurück – Beute wartet in der Flotte!`));
  const res = RES_IDS.filter((k) => r.res[k] >= 1).map((k) => `${RES_META[k].emoji} +${fmt(r.res[k], false)}`);
  if (res.length) lines.push(center(`🪐 Kolonien: ${res.join(' · ')}`));
  for (const m of r.mega) {
    const d = MEGA_INDEX[m.id];
    if (d) lines.push(center(`${d.emoji} <b>${d.name}: Stufe ${m.stage} fertig</b> – ${d.stages[m.stage - 1]}`));
  }
  if (r.built.length) lines.push(center(`🏗️ ${r.built.length} Kolonie-Bau${r.built.length === 1 ? '' : 'ten'} fertig geworden`));
  if (r.labBuys) lines.push(center(`🧠 Auto-Labor: ${r.labBuys} Forschung${r.labBuys === 1 ? '' : 'en'} gekauft`));
  const waiting = G.s.events.queue.length;
  if (waiting) lines.push(center(`📡 ${waiting} Funkspr${waiting === 1 ? 'uch wartet' : 'üche warten'} auf deine Entscheidung`));
  const canDouble = r.runEarned > 0;
  // kam die letzte Supernova kurz vor dem Zurückkommen, wäre der aktuelle Lauf fast 0 – dann die Gesamtsumme zeigen
  const showRun = r.supernovas > 0 && r.runEarned >= r.earned * 0.05;
  showModal({
    hero: '🌙',
    title: 'Willkommen zurück!',
    body: [
      `Du warst <b>${fmtTime(r.seconds)}</b> weg. Deine Manager und Roboter haben weitergearbeitet:`,
      `<div class="big-num gold-c num" style="text-align:center;margin:10px 0">+${fmt(showRun ? r.runEarned : r.earned)}</div>`,
      showRun ? center('im aktuellen Lauf seit der letzten Supernova') : r.supernovas ? center('insgesamt, vor und nach den Supernovas') : '',
      ...lines,
      r.capped ? `<span class="hint">Offline-Speicher voll nach ${fmtTime(r.counted)} – erweitere ihn im Labor (🔋) oder mit Artefakten.</span>` : '',
    ].filter(Boolean),
    actions: [
      ...(canDouble
        ? [{
            label: `✨ Verdoppeln (${cost} 💎)`,
            cls: 'cyan',
            onClick: () => {
              if (G.s.gems < cost) {
                sfx.error();
                toast('💎', 'Nicht genug Kristalle');
                return false;
              }
              G.s.gems -= cost;
              earn(G.s, r.runEarned);
              sfx.claim();
              burst(window.innerWidth / 2, window.innerHeight * 0.6, '#ffd166', 40, 'coin', 1.4);
            },
          }]
        : []),
      {
        label: '💰 Super!',
        cls: '',
        onClick: () => {
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
