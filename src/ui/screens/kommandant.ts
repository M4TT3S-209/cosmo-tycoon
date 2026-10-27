// Kommandant: Talentbaum, Fähigkeiten (und ab Schritt 4 Fraktionen)
import { ABILITIES, ABILITY_SLOTS, BRANCHES, TALENTS, rowRequirement, type BranchId, type TalentDef } from '../../data/talents';
import {
  COMMANDER_UNLOCK_RANK, abilityReadyIn, abilityUnlocked, branchPoints, commanderUnlocked, learnBlock, learnTalent,
  respec, respecCost, talentPointsFree, talentPointsSpent, talentPointsTotal, talentRank, toggleAbility,
} from '../../core/commander';
import { rankTitle } from '../../core/rank';
import { fmt, fmtTime } from '../../core/format';
import { FACTIONS, OFFERS, REP_LEVELS, REP_NAMES } from '../../data/factions';
import { buyOffer, eventsUnlocked, factionLevel, factionRep, offerBought, offerPrice } from '../../core/events';
import { G } from '../ctx';
import { h, setClass, setScale, setText, clear } from '../dom';
import { burstAt, toast } from '../fx';
import { showModal } from '../modal';
import { sfx, haptic } from '../../audio/sfx';
import { createGroup } from './group';
import type { Screen } from './types';

let branchSel: BranchId = 'industrie';

function createTalente(): Screen {
  const el = h('div', { class: 'screen' });
  let freeEl: HTMLElement;
  let learnBtns: { id: string; btn: HTMLElement }[] = [];

  function talentCard(t: TalentDef): HTMLElement {
    const s = G.s;
    const r = talentRank(s, t.id);
    const block = learnBlock(s, t.id);
    const maxed = r >= t.max;
    const excluded = block === 'choice';
    const rowLocked = block === 'row';
    const now = r > 0 ? t.desc(r) : null;
    const next = !maxed ? t.desc(r + 1) : null;
    let right: HTMLElement;
    if (maxed) right = h('span', { class: 'owned-tag' }, t.max > 1 ? 'MAX' : '✓');
    else if (excluded) right = h('span', { class: 'tag' }, '✗');
    else if (rowLocked) right = h('span', { class: 'tag' }, '🔒');
    else {
      const btn = h('button', { class: 'btn small violet' }, r > 0 ? '+1' : 'Lernen');
      btn.addEventListener('click', () => {
        if (learnTalent(G.s, t.id)) {
          sfx.upgrade();
          haptic();
          burstAt(btn, '#c084fc', 22, 'spark', 1);
          if (t.ability) toast(t.emoji, `Neue Fähigkeit: ${t.name}`, 'Sie liegt jetzt in deiner Leiste oben – einfach antippen!', true, 4500);
        } else sfx.error();
      });
      learnBtns.push({ id: t.id, btn });
      right = btn;
    }
    return h('div', { class: 'card talent' + (r > 0 ? ' glow' : '') + (excluded || rowLocked ? ' locked' : '') },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round' }, t.emoji),
        h('div', { class: 'col' },
          h('div', { class: 'title' }, t.name, ' ', h('span', { class: 'tag' }, `${r}/${t.max}`)),
          now ? h('div', { class: 'sub good-c' }, now) : null,
          next ? h('div', { class: 'sub' }, (r > 0 ? 'Nächste Stufe: ' : '') + next) : null,
          excluded ? h('div', { class: 'hint' }, 'Du hast dich für das andere Talent entschieden.') : null,
        ),
        right,
      ),
    );
  }

  function build(): void {
    clear(el);
    learnBtns = [];
    const s = G.s;
    freeEl = h('b', { class: 'num' }, '');
    const resetBtn = h('button', { class: 'btn small ghost' }, `↺ ${respecCost(s)} 💎`);
    resetBtn.addEventListener('click', () => {
      showModal({
        hero: '↺',
        title: 'Talente zurücksetzen?',
        body: [`Alle ${talentPointsSpent(G.s)} Punkte kommen zurück und du kannst neu verteilen. Kosten: <b>${respecCost(G.s)} 💎</b> (jedes Mal teurer, höchstens 3200).`],
        actions: [
          { label: `↺ Zurücksetzen (${respecCost(G.s)} 💎)`, cls: 'violet', onClick: () => { if (respec(G.s)) { sfx.claim(); toast('↺', 'Talente zurückgesetzt', 'Verteile deine Punkte neu.'); } else sfx.error(); } },
          { label: 'Abbrechen', cls: 'ghost' },
        ],
      });
    });
    el.appendChild(h('div', { class: 'card glow', style: '--c:#c084fc' },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round', style: '--c:#c084fc' }, '👤'),
        h('div', { class: 'col' },
          h('div', { class: 'title' }, `${rankTitle(s.rank.level)} · Level ${s.rank.level}`),
          h('div', { class: 'sub' }, '🎯 ', freeEl, ` von ${talentPointsTotal(s)} Talentpunkten frei · 1 Punkt pro Level`),
        ),
        talentPointsSpent(s) > 0 ? resetBtn : null,
      ),
    ));

    const seg = h('div', { class: 'seg' });
    for (const b of BRANCHES) {
      const btn = h('button', null, `${b.emoji} ${b.name} `, h('span', { class: 'num' }, String(branchPoints(s, b.id))));
      setClass(btn, 'on', branchSel === b.id);
      btn.addEventListener('click', () => {
        branchSel = b.id;
        sfx.click();
        haptic();
        build();
      });
      seg.appendChild(btn);
    }
    el.appendChild(h('div', { class: 'sticky' }, seg));

    const branch = BRANCHES.find((b) => b.id === branchSel)!;
    const inBranch = branchPoints(s, branch.id);
    for (let row = 1; row <= 8; row++) {
      const list = TALENTS.filter((t) => t.branch === branch.id && t.row === row);
      if (!list.length) continue;
      const need = rowRequirement(row);
      const box = h('div', { class: 'talent-row' + (inBranch < need ? ' row-locked' : '') });
      box.style.setProperty('--c', branch.color);
      box.appendChild(h('div', { class: 'row-label' },
        `Reihe ${row}`,
        list.length > 1 ? ' · Entweder – oder' : '',
        inBranch < need ? ` · 🔒 ab ${need} Punkten im Zweig (${inBranch}/${need})` : '',
      ));
      list.forEach((t, k) => {
        if (k > 0) box.appendChild(h('div', { class: 'or' }, 'oder'));
        box.appendChild(talentCard(t));
      });
      el.appendChild(box);
    }
  }

  function update(): void {
    setText(freeEl, String(talentPointsFree(G.s)));
    for (const b of learnBtns) setClass(b.btn, 'off', learnBlock(G.s, b.id) !== null);
  }

  return { el, build, update, title: 'Talente' };
}

function createFaehigkeiten(): Screen {
  const el = h('div', { class: 'screen' });
  let rows: { id: string; status: HTMLElement }[] = [];

  function build(): void {
    clear(el);
    rows = [];
    const s = G.s;
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'title' }, '⚡ Aktive Fähigkeiten'),
      h('div', { class: 'sub', style: 'margin-top:4px' }, `Bis zu ${ABILITY_SLOTS} Fähigkeiten liegen in deiner Leiste in der Kopfzeile. Tippe dort darauf, um sie einzusetzen – danach laden sie wieder auf, auch offline.`),
    ));
    for (const a of ABILITIES) {
      const unlocked = abilityUnlocked(s, a);
      const equipped = s.commander.abilities.includes(a.id);
      const status = h('div', { class: 'sub num' }, '');
      let right: HTMLElement;
      if (!unlocked) {
        const t = a.talent ? TALENTS.find((x) => x.id === a.talent) : null;
        right = h('span', { class: 'tag' }, '🔒');
        setText(status, t ? `Freischalten: Talent „${t.name}“ (${BRANCHES.find((b) => b.id === t.branch)!.name}, Reihe ${t.row})` : `Freischalten: Kommandanten-Level ${a.rank}`);
      } else {
        const btn = h('button', { class: 'btn small ' + (equipped ? 'green' : 'ghost') }, equipped ? '✓ In der Leiste' : 'In die Leiste');
        btn.addEventListener('click', () => {
          if (toggleAbility(G.s, a.id)) {
            sfx.click();
            haptic();
          } else {
            sfx.error();
            toast('⚡', 'Leiste voll', `Höchstens ${ABILITY_SLOTS} Fähigkeiten – nimm erst eine heraus.`);
          }
        });
        right = btn;
        rows.push({ id: a.id, status });
      }
      el.appendChild(h('div', { class: 'card' + (unlocked ? '' : ' locked') + (equipped ? ' glow' : ''), style: '--c:#fbbf24' },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round', style: '--c:#fbbf24' }, a.emoji),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, a.name),
            h('div', { class: 'sub' }, a.desc),
            h('div', { class: 'hint' }, `Abklingzeit: ${fmtTime(a.cooldown)}`),
            status,
          ),
          right,
        ),
      ));
    }
  }

  function update(): void {
    for (const r of rows) {
      const left = abilityReadyIn(G.s, r.id, G.now);
      setText(r.status, left > 0 ? `⏳ Bereit in ${fmtTime(left)}` : '✅ Bereit');
    }
  }

  return { el, build, update, title: 'Fähigkeiten' };
}

function createFraktionen(): Screen {
  const el = h('div', { class: 'screen' });
  let rows: { fill: HTMLElement; text: HTMLElement; id: string }[] = [];
  let offerBtns: { id: string; btn: HTMLElement }[] = [];

  function build(): void {
    clear(el);
    rows = [];
    offerBtns = [];
    const s = G.s;
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'title' }, '🤝 Fraktionen'),
      h('div', { class: 'sub', style: 'margin-top:4px' }, eventsUnlocked(s)
        ? 'Vier Mächte beobachten, wie du handelst. Funksprüche bringen Ruf – manchmal auf Kosten einer anderen Fraktion. Jede Ruf-Stufe gibt einen dauerhaften Vorteil und öffnet Angebote im Wochen-Shop.'
        : 'Nach deiner ersten Supernova erreichen dich Funksprüche – damit beginnt dein Ruf bei den Fraktionen.'),
    ));
    for (const f of FACTIONS) {
      const lvl = factionLevel(s, f.id);
      const fill = h('i');
      const text = h('div', { class: 'sub num' }, '');
      rows.push({ fill, text, id: f.id });
      const perks = h('div', { class: 'perk-list' }, ...f.perks.map((p, i) =>
        h('div', { class: 'perk' + (lvl > i ? ' on' : '') }, lvl > i ? '✅ ' : `🔒 ${REP_NAMES[i + 1]}: `, p)));
      const shop = h('div', { class: 'offer-list' });
      for (const o of OFFERS.filter((x) => x.faction === f.id)) {
        const price = offerPrice(s, o.id);
        const priceText = [price.gems ? `${price.gems} 💎` : '', price.em ? `${fmt(price.em, false)} ⚗️` : ''].filter(Boolean).join(' + ');
        let right: HTMLElement;
        if (lvl < o.level) right = h('span', { class: 'tag' }, `🔒 ${REP_NAMES[o.level]}`);
        else if (offerBought(s, o.id, G.now)) right = h('span', { class: 'owned-tag' }, '✓ diese Woche');
        else {
          const btn = h('button', { class: 'btn small cyan' }, priceText);
          btn.addEventListener('click', () => {
            const r = buyOffer(G.s, o.id, Date.now());
            if (r.ok) {
              sfx.claim();
              haptic();
              burstAt(btn, f.color, 24, 'spark', 1);
              toast(o.emoji, o.name, r.lines.join(' · '), true, 4000);
            } else {
              sfx.error();
              toast(o.emoji, r.text);
            }
          });
          offerBtns.push({ id: o.id, btn });
          right = btn;
        }
        shop.appendChild(h('div', { class: 'row offer' },
          h('span', { style: 'font-size:22px' }, o.emoji),
          h('div', { class: 'col' }, h('div', { style: 'font-weight:800' }, o.name), h('div', { class: 'sub' }, o.desc)),
          right,
        ));
      }
      el.appendChild(h('div', { class: 'card faction' + (lvl > 0 ? ' glow' : ''), style: `--c:${f.color}` },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round', style: `--c:${f.color}` }, f.emoji),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, f.name, ' ', h('span', { class: 'tag' }, REP_NAMES[lvl])),
            h('div', { class: 'sub' }, f.leader),
          ),
        ),
        h('div', { class: 'hint', style: 'margin:6px 0' }, f.desc),
        h('div', { class: 'progress' }, fill),
        text,
        perks,
        h('div', { class: 'section-title', style: 'margin-top:10px' }, '🛒 Wochen-Shop'),
        shop,
      ));
    }
  }

  function update(): void {
    const s = G.s;
    for (const r of rows) {
      const rep = factionRep(s, r.id as 'gilde');
      const lvl = factionLevel(s, r.id as 'gilde');
      const lo = lvl === 0 ? 0 : REP_LEVELS[lvl - 1];
      const hi = REP_LEVELS[lvl];
      setScale(r.fill, hi ? (rep - lo) / (hi - lo) : 1);
      setText(r.text, hi ? `${fmt(rep, false)} / ${fmt(hi, false)} Ruf bis „${REP_NAMES[lvl + 1]}“` : `${fmt(rep, false)} Ruf – höchste Stufe!`);
    }
    for (const b of offerBtns) {
      const p = offerPrice(s, b.id);
      setClass(b.btn, 'off', s.gems < p.gems || s.fleet.em < p.em);
    }
  }

  return { el, build, update, title: 'Fraktionen' };
}

export function createKommandant(): Screen {
  const el = h('div', { class: 'screen' });
  const group = createGroup('kommandant', 'Kommando', [
    { id: 'talente', label: '🌳 Talente', screen: createTalente(), badge: () => talentPointsFree(G.s) > 0 },
    { id: 'faehigkeiten', label: '⚡ Fähigkeiten', screen: createFaehigkeiten() },
    { id: 'fraktionen', label: '🤝 Fraktionen', screen: createFraktionen() },
  ]);
  let locked = true;

  function build(): void {
    clear(el);
    locked = !commanderUnlocked(G.s);
    if (locked) {
      el.appendChild(h('div', { class: 'card nova-hero locked' },
        h('div', { style: 'font-size:60px' }, '👤'),
        h('div', { class: 'title' }, 'Kommando'),
        h('div', { class: 'sub', style: 'margin-top:6px' }, `Ab Kommandanten-Level ${COMMANDER_UNLOCK_RANK} verteilst du hier Talentpunkte und schaltest Fähigkeiten frei. (${G.s.rank.level}/${COMMANDER_UNLOCK_RANK})`),
      ));
      return;
    }
    group.build();
    el.appendChild(group.el);
  }

  function update(dt: number): void {
    if (locked) {
      if (commanderUnlocked(G.s)) G.dirty = true;
      return;
    }
    group.update(dt);
  }

  return { el, build, update, title: 'Kommando' };
}

export function kommandantBadge(): boolean {
  return commanderUnlocked(G.s) && talentPointsFree(G.s) > 0;
}
