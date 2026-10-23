// Geführter Einstieg (Coach-Marks) + einmalige Tipps
import { MANAGERS } from '../data/managers';
import { UPGRADES } from '../data/upgrades';
import { pendingStardust } from '../core/economy';
import type { GameState } from '../core/state';
import { G, isIOS, isStandalone } from './ctx';
import { h } from './dom';
import { toast } from './fx';
import { showModal, isModalOpen } from './modal';
import { tabButton } from './hud';
import { saveGame } from '../core/save';

interface Step {
  text: string;
  target: () => Element | null;
  when?: (s: GameState) => boolean;
  done: (s: GameState) => boolean;
}

const q = (sel: string) => () => document.querySelector(sel);

const STEPS: Step[] = [
  {
    text: 'Tippe auf den Schrottsammler, um Weltraumschrott zu sammeln! 👆',
    target: q('.bld[data-b="0"] .bld-icon'),
    done: (s) => s.stats.taps >= 1,
  },
  {
    text: 'Gut gemacht! Kaufe mehr Sammler – jeder bringt mehr Geld pro Runde.',
    target: q('.bld[data-b="0"] .buy'),
    when: (s) => s.cash >= 4.3,
    done: (s) => s.buildings[0].owned >= 4,
  },
  {
    text: 'Schalte den Asteroiden-Bohrer frei – er bringt viel mehr ein!',
    target: q('.bld[data-b="1"] .buy'),
    when: (s) => s.cash >= 60,
    done: (s) => s.buildings[1].owned >= 1,
  },
  {
    text: 'Stelle einen Manager ein – er arbeitet für dich, sogar wenn du offline bist!',
    target: () => (G.tab === 'manager' ? document.querySelector('.mgr-card .btn') : tabButton('manager')),
    when: (s) => s.cash >= MANAGERS[0].cost,
    done: (s) => s.managers.some(Boolean),
  },
  {
    text: 'Perfekt! Zurück zu deinen Anlagen – baue dein Imperium aus. 🚀',
    target: () => (G.tab === 'anlagen' ? null : tabButton('anlagen')),
    done: () => G.tab === 'anlagen',
  },
];

let coach: HTMLElement | null = null;
let ring: HTMLElement | null = null;
let app: HTMLElement;
let installHint: HTMLElement | null = null;
let timer = 0;

export function initTutorial(root: HTMLElement): void {
  app = root;
}

export function showIntro(onDone: () => void): void {
  showModal({
    hero: '🚀',
    title: 'Willkommen, Kommandant!',
    body: [
      'Die Erde hat keinen Platz mehr – aber das All ist voller Schätze. Du startest mit einem einzigen <b>Schrottsammler</b> im Erdorbit.',
      'Baue Anlagen, stelle Manager ein und erobere Planet für Planet. Und wenn dein Imperium groß genug ist … lass es als <b>Supernova</b> explodieren und starte stärker neu! 💥',
    ],
    actions: [{ label: "🚀 Los geht's!", cls: 'violet' }],
    dismissable: false,
    onClose: onDone,
  });
}

function hideCoach(): void {
  coach?.remove();
  ring?.remove();
  coach = null;
  ring = null;
}

function showCoach(target: Element, text: string): void {
  const r = target.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.width === 0 || r.bottom < 60 || r.top > vh - 40) {
    hideCoach();
    return;
  }
  if (!coach) {
    coach = h('div', { class: 'coach' });
    ring = h('div', { class: 'coach-ring' });
    app.append(ring, coach);
  }
  if (coach.textContent !== text) coach.textContent = text;
  const pad = 6;
  ring!.style.left = `${r.left - pad}px`;
  ring!.style.top = `${r.top - pad}px`;
  ring!.style.width = `${r.width + pad * 2}px`;
  ring!.style.height = `${r.height + pad * 2}px`;
  const cw = Math.min(250, window.innerWidth - 24);
  coach.style.width = `${cw}px`;
  let left = r.left + r.width / 2 - cw / 2;
  left = Math.max(12, Math.min(window.innerWidth - cw - 12, left));
  const below = r.top < vh * 0.55;
  const ch = coach.offsetHeight || 60;
  coach.style.left = `${left}px`;
  coach.style.top = below ? `${r.bottom + 14}px` : `${r.top - ch - 14}px`;
  coach.classList.toggle('below', below);
  coach.classList.toggle('above', !below);
  coach.style.setProperty('--ax', `${Math.max(12, Math.min(cw - 26, r.left + r.width / 2 - left - 7))}px`);
}

export function updateTutorial(dt: number): void {
  const s = G.s;
  const t = s.tutorial;
  if (t.step >= 1 && t.step <= STEPS.length && !isModalOpen()) {
    const step = STEPS[t.step - 1];
    if (step.done(s)) {
      t.step++;
      hideCoach();
      if (t.step > STEPS.length) saveGame(s);
    } else if (!step.when || step.when(s)) {
      const target = step.target();
      if (target) showCoach(target, step.text);
      else hideCoach();
    } else hideCoach();
  } else if (coach) hideCoach();

  timer += dt;
  if (timer < 1) return;
  timer = 0;
  tips(s);
}

function tips(s: GameState): void {
  const f = s.tutorial.flags;
  if (s.tutorial.step <= STEPS.length) return;
  if (!f.upgrade && UPGRADES[0].cost <= s.cash) {
    f.upgrade = true;
    toast('⬆️', 'Erstes Upgrade verfügbar!', 'Upgrades verdreifachen den Ertrag – schau in den Upgrades-Tab.', false, 4500);
  }
  if (!f.supernova && pendingStardust(s) >= 1 && s.totalSupernovas === 0) {
    f.supernova = true;
    toast('💥', 'Supernova möglich!', 'Im Kosmos-Tab kannst du dein Imperium für Sternenstaub sprengen. Ab 10 ✨ lohnt es sich richtig!', true, 5500);
  }
  if (!f.supernova10 && pendingStardust(s) >= 10 && s.totalSupernovas === 0) {
    f.supernova10 = true;
    toast('🌕', 'Bereit für den Mond!', 'Mit 10 ✨ erreichst du den Mond – löse jetzt deine erste Supernova aus!', true, 5500);
  }
  if (!f.lab && s.stardust > 0) {
    f.lab = true;
    toast('🧪', 'Sternen-Labor geöffnet', 'Investiere Sternenstaub in dauerhafte Forschung (Kosmos → Labor).', false, 5000);
  }
  // Installations-Hinweis für iPhone
  if (isIOS && !isStandalone && !s.installHintDismissed && !installHint && s.stats.playTime > 120) {
    installHint = h('div', { class: 'install-hint' },
      h('span', { style: 'font-size:24px' }, '📲'),
      h('div', { style: 'flex:1' }, h('b', null, 'Als App installieren: '), 'Tippe auf „Teilen“ □↑ und dann „Zum Home-Bildschirm“.'),
      h('button', { class: 'x', 'aria-label': 'Schließen', onClick: () => {
        s.installHintDismissed = true;
        installHint?.remove();
      } }, '✕'),
    );
    app.appendChild(installHint);
  }
}

export function tutorialActive(): boolean {
  return G.s.tutorial.step >= 1 && G.s.tutorial.step <= STEPS.length;
}
