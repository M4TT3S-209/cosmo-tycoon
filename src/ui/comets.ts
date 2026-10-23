// Goldene Kometen: fliegen über den Bildschirm, Antippen gibt eine Belohnung
import { collectComet } from '../core/actions';
import { G } from './ctx';
import { h } from './dom';
import { burst, floatText, toast } from './fx';
import { isModalOpen } from './modal';
import { sfx, haptic } from '../audio/sfx';

interface Comet {
  el: HTMLElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  arc: number;
  caught: boolean;
}

let layer: HTMLElement;
const comets: Comet[] = [];

export function initComets(app: HTMLElement): void {
  layer = h('div', { id: 'comet-layer' });
  app.appendChild(layer);
}

export function spawnComet(): boolean {
  if (isModalOpen() || document.hidden) return false;
  const w = window.innerWidth;
  const hh = window.innerHeight;
  const fromLeft = Math.random() < 0.5;
  const y0 = hh * (0.25 + Math.random() * 0.35);
  const y1 = y0 + hh * (Math.random() * 0.25 - 0.05);
  const el = h('div', { class: 'comet', role: 'button', 'aria-label': 'Goldener Komet' }, '☄️');
  if (fromLeft) el.style.scale = '-1 1';
  const c: Comet = {
    el,
    x0: fromLeft ? -60 : w + 60,
    y0,
    x1: fromLeft ? w + 60 : -60,
    y1,
    t: 0,
    dur: 9 + Math.random() * 2,
    arc: (Math.random() - 0.5) * hh * 0.18,
    caught: false,
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    catchComet(c);
  });
  layer.appendChild(el);
  comets.push(c);
  sfx.cometSpawn();
  if (!G.s.tutorial.flags.comet) {
    G.s.tutorial.flags.comet = true;
    toast('☄️', 'Ein goldener Komet!', 'Schnell antippen – er bringt eine Belohnung!', true, 4000);
  }
  return true;
}

function catchComet(c: Comet): void {
  if (c.caught) return;
  c.caught = true;
  const r = c.el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const res = collectComet(G.s, Date.now());
  sfx.comet();
  haptic();
  burst(x, y, '#ffd166', 40, 'spark', 1.6);
  burst(x, y, '#ffd166', 16, 'coin', 1.2);
  floatText(x, y - 20, res.kind === 'gems' ? '💎!' : '☄️!', '#ffd166', true);
  toast('☄️', res.text, undefined, true);
  c.el.remove();
}

export function updateComets(dt: number): void {
  for (let i = comets.length - 1; i >= 0; i--) {
    const c = comets[i];
    if (c.caught) {
      comets.splice(i, 1);
      continue;
    }
    c.t += dt;
    const k = c.t / c.dur;
    if (k >= 1) {
      c.el.remove();
      comets.splice(i, 1);
      continue;
    }
    const x = c.x0 + (c.x1 - c.x0) * k;
    const y = c.y0 + (c.y1 - c.y0) * k + Math.sin(k * Math.PI) * c.arc;
    c.el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  }
}
