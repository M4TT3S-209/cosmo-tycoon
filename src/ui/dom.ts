// Minimaler DOM-Helfer ohne Framework

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & {
  class?: string;
  style?: string;
  onClick?: (e: MouseEvent) => void;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v as string;
      else if (k === 'style') el.setAttribute('style', v as string);
      else if (k === 'onClick') el.addEventListener('click', v as EventListener);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'html') el.innerHTML = v as string;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Setzt textContent nur bei Änderung (spart Layout-Arbeit im Frame-Loop) */
export function setText(el: Element, text: string): void {
  if ((el as HTMLElement & { _t?: string })._t !== text) {
    (el as HTMLElement & { _t?: string })._t = text;
    el.textContent = text;
  }
}

export function setClass(el: Element, cls: string, on: boolean): void {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

/** scaleX für Fortschrittsbalken, nur bei spürbarer Änderung */
export function setScale(el: HTMLElement, v: number): void {
  const x = Math.max(0, Math.min(1, v || 0));
  const prev = (el as HTMLElement & { _s?: number })._s;
  if (prev === undefined || Math.abs(prev - x) > 0.002) {
    (el as HTMLElement & { _s?: number })._s = x;
    el.style.transform = `scaleX(${x})`;
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Münz-Icon als Element */
export function coin(small = true): HTMLElement {
  return h('span', { class: small ? 'coin small' : 'coin' }, '¢');
}

/**
 * Tippen + Gedrückthalten: löst sofort einmal aus, wiederholt nach 350 ms immer schneller.
 * Abbruch, wenn der Finger scrollt.
 */
export function pressRepeat(el: HTMLElement, fn: () => void): void {
  let timer = 0;
  let delay = 0;
  let startY = 0;
  let startX = 0;
  let repeated = false;
  const stop = () => {
    clearTimeout(timer);
    timer = 0;
  };
  const loop = () => {
    repeated = true;
    fn();
    delay = Math.max(45, delay * 0.82);
    timer = window.setTimeout(loop, delay);
  };
  el.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    repeated = false;
    delay = 160;
    stop();
    timer = window.setTimeout(loop, 380);
  });
  el.addEventListener('pointermove', (e) => {
    if (timer && (Math.abs(e.clientY - startY) > 10 || Math.abs(e.clientX - startX) > 10)) stop();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, stop);
  el.addEventListener('click', (e) => {
    if (repeated) {
      e.preventDefault();
      repeated = false;
      return;
    }
    fn();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function sphereEl(p: { sphere: [string, string, string]; glow: string; ring?: string }, cls = ''): HTMLElement {
  const el = h('div', { class: 'sphere ' + cls + (p.ring ? ' has-ring' : '') });
  el.style.setProperty('--s1', p.sphere[0]);
  el.style.setProperty('--s2', p.sphere[1]);
  el.style.setProperty('--s3', p.sphere[2]);
  el.style.setProperty('--sg', p.glow);
  if (p.ring) el.style.setProperty('--sr', p.ring);
  return el;
}
