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
import { grantArtifact, randomArtifactOf, rollRarity } from '../core/fleet';
import { addXp, xpForNext } from '../core/rank';
import { RES_IDS } from '../core/colonies';
import { pushEvent } from '../core/events';
import { EVENTS } from '../data/events';

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
      act('🚀 Expeditionen sofort fertig', () => {
        for (const m of s().fleet.missions) m.end = Date.now() - 1;
      }),
      act('⚗️ +1000 Exotische Materie', () => { s().fleet.em += 1000; s().fleet.emEarned += 1000; }),
      act('🏺 Zufälliges Artefakt', () => {
        const f = grantArtifact(s(), randomArtifactOf(rollRarity([40, 30, 20, 10], Math.random), Math.random));
        toast('🏺', f.id, f.isNew ? 'neu' : 'Stufe ' + f.level);
      }),
      act('🏅 Prüfungsziel erreichen', () => {
        if (s().challenge.active) earn(s(), Math.max(0, s().challenge.goal - s().runEarnings) * 1.01);
      }),
      act('⭐ +1 Rang-Level', () => addXp(s(), xpForNext(s().rank.level) - s().rank.xp)),
      act('💥 3 Supernovas gutschreiben', () => { s().totalSupernovas += 3; }),
      act('🪐 +10.000 aller Rohstoffe', () => { for (const k of RES_IDS) s().res[k] += 10000; }),
      act('🏗️ Bauten sofort fertig', () => {
        for (const k in s().colonies) {
          const c = s().colonies[k];
          if (c.build) c.build.end = Date.now() - 1;
          if (c.grow) c.grow = Date.now() - 1;
        }
        if (s().mega.build) s().mega.build!.end = Date.now() - 1;
      }),
      act('📡 Funkspruch jetzt', () => {
        const pool = EVENTS.filter((e) => !e.chainOnly);
        pushEvent(s(), pool[Math.floor(Math.random() * pool.length)].id, Date.now());
      }),
      act('🗓️ Neue Woche', () => { s().weekly.key = ''; }),
      { label: 'Schließen', cls: 'violet' },
    ],
  });
}
