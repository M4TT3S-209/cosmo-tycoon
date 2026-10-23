// Effekte: schwebende Zahlen, Partikel, Shake, Blitz, Toasts
import { h } from './dom';

let layer: HTMLElement;
let canvas: HTMLCanvasElement;
let c2d: CanvasRenderingContext2D;
let toastBox: HTMLElement;
let shell: HTMLElement;
let root: HTMLElement;
let dpr = 1;
let floats = 0;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'dot' | 'coin' | 'spark';
}
const particles: Particle[] = [];

export function initFx(app: HTMLElement, shellEl: HTMLElement): void {
  root = app;
  shell = shellEl;
  canvas = h('canvas', { id: 'fx-canvas' });
  layer = h('div', { id: 'fx-layer' });
  toastBox = h('div', { id: 'toasts' });
  app.append(canvas, layer, toastBox);
  c2d = canvas.getContext('2d')!;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
}

/** Schwebender Text (z. B. "+12,3 K") an Bildschirmposition */
export function floatText(x: number, y: number, text: string, color = '#ffd166', big = false): void {
  if (floats > 24) return;
  floats++;
  const el = h('div', { class: 'float' + (big ? ' big' : '') }, text);
  el.style.color = color;
  el.style.setProperty('--x', `${Math.round(x)}px`);
  el.style.setProperty('--y', `${Math.round(y)}px`);
  // zentrieren, sobald Breite bekannt
  el.style.marginLeft = '-40px';
  layer.appendChild(el);
  requestAnimationFrame(() => {
    el.style.marginLeft = `${-el.offsetWidth / 2}px`;
  });
  setTimeout(() => {
    el.remove();
    floats--;
  }, 1150);
}

export function floatAt(target: Element, text: string, color?: string, big = false): void {
  const r = target.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  floatText(r.left + r.width / 2, r.top + r.height / 2 - 8, text, color, big);
}

export function burst(x: number, y: number, color = '#ffd166', count = 14, kind: Particle['kind'] = 'dot', power = 1): void {
  if (particles.length > 400) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (60 + Math.random() * 220) * power;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 80 * power,
      life: 0,
      max: 0.6 + Math.random() * 0.6,
      size: kind === 'coin' ? 4 + Math.random() * 3 : 1.5 + Math.random() * 2.5,
      color,
      kind,
    });
  }
}

export function burstAt(target: Element, color?: string, count?: number, kind?: Particle['kind'], power?: number): void {
  const r = target.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  burst(r.left + r.width / 2, r.top + r.height / 2, color, count, kind, power);
}

export function updateFx(dt: number): void {
  if (!particles.length) {
    if ((canvas as HTMLCanvasElement & { _dirty?: boolean })._dirty) {
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      (canvas as HTMLCanvasElement & { _dirty?: boolean })._dirty = false;
    }
    return;
  }
  (canvas as HTMLCanvasElement & { _dirty?: boolean })._dirty = true;
  c2d.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += 420 * dt;
    p.vx *= 1 - 1.5 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const a = 1 - p.life / p.max;
    c2d.globalAlpha = a;
    if (p.kind === 'coin') {
      c2d.fillStyle = '#ffd166';
      c2d.beginPath();
      c2d.ellipse(p.x, p.y, p.size, p.size * (0.4 + 0.6 * Math.abs(Math.sin(p.life * 12))), 0, 0, Math.PI * 2);
      c2d.fill();
      c2d.fillStyle = '#b8770a';
      c2d.fillRect(p.x - 0.5, p.y - p.size * 0.4, 1, p.size * 0.8);
    } else if (p.kind === 'spark') {
      c2d.strokeStyle = p.color;
      c2d.lineWidth = p.size * 0.6;
      c2d.beginPath();
      c2d.moveTo(p.x, p.y);
      c2d.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      c2d.stroke();
    } else {
      c2d.fillStyle = p.color;
      c2d.beginPath();
      c2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c2d.fill();
    }
  }
  c2d.globalAlpha = 1;
}

export function shake(): void {
  shell.classList.remove('shake');
  void shell.offsetWidth;
  shell.classList.add('shake');
  setTimeout(() => shell.classList.remove('shake'), 520);
}

export function flash(withShock = true): void {
  const f = h('div', { class: 'flash-overlay' });
  root.appendChild(f);
  setTimeout(() => f.remove(), 1700);
  if (withShock) {
    const s = h('div', { class: 'shockwave' });
    root.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}

export function toast(emoji: string, title: string, sub?: string, gold = false, ms = 2600): void {
  while (toastBox.children.length >= 2) toastBox.firstElementChild?.remove();
  const t = h('div', { class: 'toast' + (gold ? ' gold' : '') }, h('div', { class: 'e' }, emoji), h('div', null, h('div', { class: 't1' }, title), sub ? h('div', { class: 't2' }, sub) : null));
  t.addEventListener('click', () => t.remove());
  toastBox.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}
