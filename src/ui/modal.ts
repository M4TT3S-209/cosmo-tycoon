// Bottom-Sheet-Modals mit Warteschlange
import { h } from './dom';
import { sfx } from '../audio/sfx';

export interface ModalAction {
  label: string | Node;
  cls?: string;
  onClick?: () => void | boolean; // false = offen lassen
}

export interface ModalOpts {
  hero?: string | Node;
  title: string;
  body?: string | Node | (string | Node)[];
  actions?: ModalAction[];
  dismissable?: boolean;
  onClose?: () => void;
}

let root: HTMLElement;
const queue: ModalOpts[] = [];
let open = false;
let closeCurrent: (() => void) | null = null;

export function initModals(app: HTMLElement): void {
  root = app;
}

export function isModalOpen(): boolean {
  return open;
}

export function showModal(opts: ModalOpts): void {
  queue.push(opts);
  if (!open) next();
}

/** Schließt das aktuelle Modal (falls offen) */
export function closeModal(): void {
  closeCurrent?.();
}

function next(): void {
  const opts = queue.shift();
  if (!opts) {
    open = false;
    return;
  }
  open = true;
  const body = h('div', { class: 'm-body' });
  if (opts.body) {
    const parts = Array.isArray(opts.body) ? opts.body : [opts.body];
    for (const p of parts) {
      if (typeof p === 'string') body.appendChild(h('p', { html: p }));
      else body.appendChild(p);
    }
  }
  const actions = h('div', { class: 'm-actions' });
  const sheet = h(
    'div',
    { class: 'modal', role: 'dialog' },
    h('div', { class: 'grab' }),
    opts.hero ? h('div', { class: 'm-hero' }, opts.hero) : null,
    h('h2', null, opts.title),
    body,
    actions,
  );
  const back = h('div', { class: 'modal-back' }, sheet);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    closeCurrent = null;
    back.classList.add('out');
    setTimeout(() => {
      back.remove();
      opts.onClose?.();
      next();
    }, 200);
  };
  closeCurrent = close;
  for (const a of opts.actions ?? [{ label: 'OK', cls: 'violet' }]) {
    const b = h('button', { class: 'btn block ' + (a.cls ?? 'violet') }, a.label);
    b.addEventListener('click', () => {
      sfx.click();
      const keep = a.onClick?.() === false;
      if (!keep) close();
    });
    actions.appendChild(b);
  }
  if (opts.dismissable !== false) {
    back.addEventListener('click', (e) => {
      if (e.target === back) close();
    });
  }
  root.appendChild(back);
}
