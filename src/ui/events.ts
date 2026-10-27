// Funkspruch-Dialog: Entscheidung treffen, Ergebnis anzeigen
import { EVENT_INDEX } from '../data/events';
import { FACTION_INDEX } from '../data/factions';
import { answerEvent, canPay, choiceChance, costText } from '../core/events';
import { G } from './ctx';
import { h } from './dom';
import { burst, toast } from './fx';
import { showModal, isModalOpen } from './modal';
import { sfx, haptic } from '../audio/sfx';

/** Öffnet den ältesten wartenden Funkspruch */
export function openNextEvent(): void {
  if (G.s.events.queue.length) openEvent(0);
}

export function openEvent(index: number): void {
  const s = G.s;
  const q = s.events.queue[index];
  const ev = q && EVENT_INDEX[q.id];
  if (!ev) return;
  const now = Date.now();
  const faction = ev.faction ? FACTION_INDEX[ev.faction] : null;
  const head = h('div', { class: 'ev-from' }, ev.from, faction ? h('span', { class: 'tag', style: `--c:${faction.color}` }, `${faction.emoji} ${faction.name}`) : null);
  showModal({
    hero: ev.hero,
    title: ev.title,
    body: [head, ev.text],
    actions: [
      ...ev.choices.map((ch, i) => {
        const chance = choiceChance(s, ch);
        const cost = costText(s, ch.cost, now);
        const meta = [chance !== null ? `🎲 ${Math.round(chance * 100)} %` : '', cost].filter(Boolean).join(' · ');
        const label = h('span', { class: 'ev-choice' }, h('b', null, ch.label), meta ? h('small', null, meta) : null);
        const affordable = canPay(s, ch.cost, now);
        return {
          label,
          cls: affordable ? (i === 0 ? 'violet' : 'ghost') : 'ghost off',
          onClick: () => {
            if (!canPay(G.s, ch.cost, Date.now())) {
              sfx.error();
              toast('📡', 'Dafür reicht es gerade nicht', cost);
              return false;
            }
            const r = answerEvent(G.s, index, i, Date.now());
            if (!r.ok) {
              sfx.error();
              toast('📡', r.text);
              return false;
            }
            if (r.success) sfx.claim();
            else sfx.error();
            haptic();
            if (r.success && r.lines.length) burst(window.innerWidth / 2, window.innerHeight * 0.55, '#a78bfa', 30, 'spark', 1.2);
            setTimeout(() => showResult(ev.hero, ev.title, r.success, r.text, r.lines), 220);
          },
        };
      }),
      { label: 'Später', cls: 'ghost' },
    ],
  });
}

function showResult(hero: string, title: string, success: boolean, text: string, lines: string[]): void {
  showModal({
    hero: success ? hero : '💢',
    title: success ? title : 'Das ging schief …',
    body: [text, lines.length ? h('div', { class: 'ev-rewards' }, ...lines.map((l) => h('span', { class: 'ev-reward' }, l))) : ''],
    actions: [{ label: G.s.events.queue.length ? `📡 Nächster Funkspruch (${G.s.events.queue.length})` : 'Weiter', cls: 'violet', onClick: () => { if (G.s.events.queue.length) setTimeout(openNextEvent, 220); } }],
  });
}

/** Hinweis beim Eintreffen – öffnet sich nicht ungefragt */
export function announceEvent(id: string): void {
  const ev = EVENT_INDEX[id];
  if (!ev) return;
  sfx.cometSpawn();
  if (!isModalOpen()) toast('📡', 'Neuer Funkspruch', `${ev.title} – tippe oben auf 📡`, true, 4000);
}
