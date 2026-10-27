// Tab mit Unterbereichen, z. B. Imperium: Anlagen | Manager | Upgrades
import { G, type TabId } from '../ctx';
import { h, setClass, clear } from '../dom';
import { sfx, haptic } from '../../audio/sfx';
import type { Screen } from './types';

export interface SubScreen {
  id: string;
  label: string;
  screen: Screen;
  badge?: () => boolean;
}

export function createGroup(tab: TabId, title: string, subs: SubScreen[]): Screen {
  const el = h('div', { class: 'screen group' });
  const badges: Record<string, HTMLElement> = {};
  let current: SubScreen | null = null;
  let badgeTimer = 0;

  const active = (): SubScreen => subs.find((x) => x.id === G.sub[tab]) ?? subs[0];

  function updateBadges(): void {
    for (const sub of subs) if (sub.badge) setClass(badges[sub.id], 'on', sub.badge());
  }

  function build(): void {
    clear(el);
    const seg = h('div', { class: 'seg group-seg' });
    for (const sub of subs) {
      const badge = h('span', { class: 'badge dot' });
      badges[sub.id] = badge;
      const b = h('button', { 'data-sub': sub.id }, sub.label, badge);
      setClass(b, 'on', active().id === sub.id);
      b.addEventListener('click', () => {
        if (G.sub[tab] === sub.id) return;
        G.sub[tab] = sub.id;
        sfx.click();
        haptic();
        G.dirty = true;
      });
      seg.appendChild(b);
    }
    el.appendChild(seg);
    current = active();
    current.screen.build();
    el.appendChild(current.screen.el);
    updateBadges();
  }

  function update(dt: number): void {
    current?.screen.update(dt);
    badgeTimer += dt;
    if (badgeTimer > 0.3) {
      badgeTimer = 0;
      updateBadges();
    }
  }

  return { el, build, update, title };
}
