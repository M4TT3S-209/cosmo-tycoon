import { LAB_BRANCHES, LAB_NODES } from '../../data/lab';
import { PLANETS, PLANET_MULT } from '../../data/planets';
import { QUANTUM_PERKS } from '../../data/quantum';
import { buyLab, buyQuantum, labAvailable } from '../../core/actions';
import {
  STARDUST_BONUS, QUANTUM_PASSIVE, canGalaxyJump, earningsForDust, earningsForNextDust, lab, pendingQuantum,
  pendingStardust, permanentMults, qlvl, QUANTUM_BASE,
} from '../../core/economy';
import { fmt, fmtMult, fmtPct } from '../../core/format';
import { galaxyJump, supernova } from '../../core/prestige';
import { G } from '../ctx';
import { h, setClass, setScale, setText, clear, sphereEl } from '../dom';
import { burstAt } from '../fx';
import { showModal } from '../modal';
import { sfx, haptic } from '../../audio/sfx';
import type { Screen } from './types';

const SUBS = [
  { id: 'nova', label: '💥 Supernova' },
  { id: 'labor', label: '🧪 Labor' },
  { id: 'planeten', label: '🪐 Planeten' },
  { id: 'galaxie', label: '⚛️ Galaxie' },
];

export function createKosmos(): Screen {
  const el = h('div', { class: 'screen' });
  let updaters: (() => void)[] = [];

  function build(): void {
    clear(el);
    updaters = [];
    const seg = h('div', { class: 'seg' });
    for (const sub of SUBS) {
      const b = h('button', null, sub.label);
      setClass(b, 'on', G.sub.kosmos === sub.id);
      b.addEventListener('click', () => {
        G.sub.kosmos = sub.id;
        sfx.click();
        haptic();
        build();
      });
      seg.appendChild(b);
    }
    el.appendChild(h('div', { class: 'sticky' }, seg));
    const sub = G.sub.kosmos;
    if (sub === 'labor') buildLab();
    else if (sub === 'planeten') buildPlanets();
    else if (sub === 'galaxie') buildGalaxy();
    else buildNova();
  }

  // ---- Supernova -----------------------------------------------------------
  function buildNova(): void {
    const s = G.s;
    const star = h('div', { class: 'star' });
    const pending = h('div', { class: 'big-num dust-c num' }, '');
    const progFill = h('i');
    const progText = h('div', { class: 'sub num', style: 'margin-top:6px' }, '');
    const rec = h('div', { class: 'recommend' }, '⭐ Empfohlen – verdoppelt deinen Sternenstaub!');
    const preview = h('div', { class: 'sub', style: 'margin-top:8px' }, '');
    const btn = h('button', { class: 'btn violet block', style: 'margin-top:14px;height:52px;font-size:17px' }, '💥 Supernova auslösen');
    btn.addEventListener('click', () => {
      const p = pendingStardust(G.s);
      if (p < 1) {
        sfx.error();
        return;
      }
      confirmSupernova(p);
    });
    el.appendChild(
      h('div', { class: 'card nova-hero glow', style: '--c:#f0abfc' },
        star,
        h('div', { class: 'sub' }, 'Sternenstaub bei Supernova'),
        pending,
        h('div', { class: 'progress', style: 'margin-top:10px' }, progFill),
        progText,
        rec,
        preview,
        btn,
      ),
    );
    const bonus = h('span', { class: 'num dust-c' }, '');
    el.appendChild(
      h('div', { class: 'card' },
        h('div', { class: 'kv' },
          h('span', null, 'Verfügbarer Sternenstaub'), h('span', { class: 'num dust-c' }, fmt(s.stardust, false) + ' ✨'),
          h('span', null, 'Insgesamt verdient'), h('span', { class: 'num' }, fmt(s.stardustEarned, false) + ' ✨'),
          h('span', null, 'Sternenstaub-Bonus'), bonus,
          h('span', null, 'Supernovas'), h('span', { class: 'num' }, String(s.totalSupernovas)),
        ),
        h('div', { class: 'hint', style: 'margin-top:10px' },
          `Jeder jemals verdiente ✨ gibt dauerhaft +${Math.round(STARDUST_BONUS * 100)} % Einkommen – auch wenn du ihn im Labor ausgibst.`),
      ),
    );
    el.appendChild(
      h('div', { class: 'card' },
        h('div', { class: 'title' }, 'Was passiert bei einer Supernova?'),
        h('div', { class: 'sub', style: 'margin-top:6px' },
          '✅ Du behältst: Sternenstaub, Labor, Planeten, Kristalle, Erfolge, Ewige Verdoppler',
          h('br'),
          `🔄 Zurückgesetzt: Geld, Anlagen, Upgrades${lab(s, 'keepmgr') ? '' : ', Manager'}`,
        ),
      ),
    );
    const next = PLANETS[s.planet + 1];
    updaters.push(() => {
      const st = G.s;
      const p = pendingStardust(st);
      setText(pending, `+${fmt(p, false)} ✨`);
      const lo = earningsForDust(st, p);
      const hi = earningsForNextDust(st);
      const frac = hi > lo ? (Math.log10(Math.max(1, st.runEarnings)) - Math.log10(Math.max(1, lo))) / (Math.log10(hi) - Math.log10(Math.max(1, lo))) : 0;
      setScale(progFill, frac);
      setText(progText, `Einnahmen dieses Laufs: ${fmt(st.runEarnings)} · nächster ✨ bei ${fmt(hi)}`);
      const recommended = p >= Math.max(10, st.stardustEarned);
      rec.style.display = recommended ? '' : 'none';
      setClass(star, 'ready', recommended);
      setClass(btn, 'off', p < 1);
      const after = st.stardustEarned + p;
      let txt = p > 0 ? `Bonus danach: +${fmtPct(STARDUST_BONUS * after)} statt +${fmtPct(STARDUST_BONUS * st.stardustEarned)}` : 'Verdiene mehr Geld, um Sternenstaub zu sammeln.';
      if (next && after >= next.need && p > 0) txt += ` · 🪐 Reise zu: ${next.name}!`;
      setText(preview, txt);
      setText(bonus, '+' + fmtPct(STARDUST_BONUS * st.stardustEarned));
    });
  }

  function confirmSupernova(p: number): void {
    const s = G.s;
    const next = PLANETS[s.planet + 1];
    const travels = next && s.stardustEarned + p >= next.need;
    showModal({
      hero: '💥',
      title: 'Supernova auslösen?',
      body: [
        `Dein Imperium explodiert und du erhältst <b class="dust-c">+${fmt(p, false)} ✨ Sternenstaub</b>.`,
        `Dein Dauer-Bonus steigt auf <b>+${fmtPct(STARDUST_BONUS * (s.stardustEarned + p))}</b> Einkommen.`,
        travels ? `🪐 Du reist weiter zum <b>${next.name}</b> (×${String(PLANET_MULT).replace('.', ',')} Einkommen)!` : '',
        `Geld, Anlagen und Upgrades${lab(s, 'keepmgr') ? '' : ' sowie Manager'} werden zurückgesetzt.`,
      ].filter(Boolean),
      actions: [
        { label: '💥 Jetzt explodieren!', cls: 'violet', onClick: () => void supernova(G.s) },
        { label: 'Noch nicht', cls: 'ghost' },
      ],
    });
  }

  // ---- Labor ----------------------------------------------------------------
  function buildLab(): void {
    const s = G.s;
    const avail = h('span', { class: 'num dust-c' }, '');
    el.appendChild(
      h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round', style: '--c:#f0abfc' }, '🧪'),
          h('div', { class: 'col' }, h('div', { class: 'title' }, 'Sternen-Labor'), h('div', { class: 'sub' }, 'Dauerhafte Forschung – bleibt bei jeder Supernova.')),
          h('div', { class: 'big-num', style: 'font-size:20px' }, avail),
        ),
      ),
    );
    updaters.push(() => setText(avail, fmt(G.s.stardust, false) + ' ✨'));
    if (s.stardustLifetime <= 0) {
      el.appendChild(h('div', { class: 'empty' }, '🔒 Löse deine erste Supernova aus, um Sternenstaub für das Labor zu sammeln.'));
    }
    for (const branch of LAB_BRANCHES) {
      el.appendChild(h('div', { class: 'section-title' }, branch));
      for (const node of LAB_NODES.filter((n) => n.branch === branch)) {
        const lvl = lab(s, node.id);
        const maxed = lvl >= node.maxLevel;
        const available = labAvailable(s, node.id);
        const pips = h('div', { class: 'pips' });
        if (node.maxLevel <= 25) for (let i = 0; i < node.maxLevel; i++) pips.appendChild(h('i', { class: i < lvl ? 'on' : '' }));
        let right: HTMLElement;
        if (maxed) right = h('span', { class: 'owned-tag' }, 'MAX');
        else if (!available) right = h('span', { class: 'tag' }, '🔒');
        else {
          const cost = node.cost(lvl);
          const btn = h('button', { class: 'btn small violet' }, `${fmt(cost, false)} ✨`);
          btn.addEventListener('click', () => {
            if (buyLab(G.s, node.id)) {
              sfx.upgrade();
              haptic();
              burstAt(btn, '#f0abfc', 20, 'spark', 1);
            } else sfx.error();
          });
          updaters.push(() => setClass(btn, 'off', cost > G.s.stardust));
          right = btn;
        }
        const req = node.requires ? LAB_NODES.find((n) => n.id === node.requires) : null;
        el.appendChild(
          h('div', { class: 'card lab-node' + (!available ? ' locked' : '') + (lvl > 0 ? ' glow' : '') },
            h('div', { class: 'row' },
              h('div', { class: 'icon-round' }, node.emoji),
              h('div', { class: 'col' },
                h('div', { class: 'title' }, node.name),
                h('div', { class: 'lab-level num' }, `Stufe ${lvl}/${node.maxLevel} · ${node.effect(lvl)}`),
                h('div', { class: 'sub' }, !available && req ? `Benötigt: ${req.emoji} ${req.name}` : maxed ? node.desc : `Nächste Stufe: ${node.effect(lvl + 1)}`),
                pips,
              ),
              right,
            ),
          ),
        );
      }
    }
  }

  // ---- Planeten ------------------------------------------------------------
  function buildPlanets(): void {
    const s = G.s;
    const pm = permanentMults(s);
    el.appendChild(
      h('div', { class: 'card' },
        h('div', { class: 'title' }, '🪐 Deine Reise durch die Galaxie'),
        h('div', { class: 'sub', style: 'margin-top:4px' },
          `Neue Planeten erreichst du bei einer Supernova, sobald du genug Sternenstaub verdient hast. Jeder Planet gibt dauerhaft ×${String(PLANET_MULT).replace('.', ',')} Einkommen. Aktuell: ${fmtMult(pm.planet)}.`),
      ),
    );
    PLANETS.forEach((p, i) => {
      const reached = i <= s.planet;
      const current = i === s.planet;
      const sp = sphereEl(p);
      const card = h('div', { class: 'card planet-row' + (current ? ' current' : '') + (!reached ? ' locked' : '') },
        h('div', { class: 'row' },
          sp,
          h('div', { class: 'col' },
            h('div', { class: 'title' }, `${p.emoji} ${p.name}`),
            h('div', { class: 'sub' }, p.desc),
            h('div', { class: 'sub num' }, i === 0 ? 'Startpunkt' : `Benötigt ${fmt(p.need, false)} ✨ insgesamt`),
          ),
          h('span', { class: 'tag' + (reached ? ' on' : '') }, current ? 'HIER' : reached ? '✓' : '🔒'),
        ),
      );
      card.style.setProperty('--sg', p.glow);
      if (!reached) sp.style.filter = 'grayscale(0.7) brightness(0.5)';
      el.appendChild(card);
    });
  }

  // ---- Galaxie-Sprung ------------------------------------------------------
  function buildGalaxy(): void {
    const s = G.s;
    const last = PLANETS[PLANETS.length - 1];
    if (s.planet < PLANETS.length - 1 && s.galaxyJumps === 0) {
      el.appendChild(
        h('div', { class: 'card nova-hero locked' },
          h('div', { style: 'font-size:60px' }, '⚛️'),
          h('div', { class: 'title' }, 'Galaxie-Sprung'),
          h('div', { class: 'sub', style: 'margin-top:6px' },
            `Erreiche den ${last.emoji} ${last.name} (${fmt(last.need, false)} ✨ insgesamt), um in eine neue Galaxie zu springen und mächtige Quantenkerne zu erhalten.`),
          h('div', { class: 'progress', style: 'margin-top:12px' }, h('i', { style: `transform:scaleX(${Math.min(1, Math.log10(1 + s.stardustEarned) / Math.log10(1 + last.need))})` })),
          h('div', { class: 'sub num', style: 'margin-top:6px' }, `${fmt(s.stardustEarned, false)} / ${fmt(last.need, false)} ✨`),
        ),
      );
      return;
    }
    const pend = h('div', { class: 'big-num q-c num' }, '');
    const btn = h('button', { class: 'btn cyan block', style: 'margin-top:12px;height:52px;font-size:17px' }, '⚛️ Galaxie-Sprung');
    btn.addEventListener('click', () => {
      if (!canGalaxyJump(G.s)) {
        sfx.error();
        return;
      }
      const q = pendingQuantum(G.s);
      showModal({
        hero: '⚛️',
        title: 'In eine neue Galaxie springen?',
        body: [
          `Du erhältst <b class="q-c">+${q} Quantenkerne</b>. Jeder Kern gibt für immer +${Math.round(QUANTUM_PASSIVE * 100)} % Einkommen und kann für Quanten-Perks ausgegeben werden.`,
          '⚠️ Sternenstaub, Labor und Planeten werden zurückgesetzt (Labor-Erbe schützt einen Teil).',
          'Kristalle, Erfolge, Ewige Verdoppler und Quanten-Perks bleiben.',
        ],
        actions: [
          { label: '⚛️ Springen!', cls: 'cyan', onClick: () => void galaxyJump(G.s) },
          { label: 'Abbrechen', cls: 'ghost' },
        ],
      });
    });
    el.appendChild(
      h('div', { class: 'card nova-hero glow', style: '--c:#a5b4fc' },
        h('div', { style: 'font-size:64px;animation:float 2.4s ease-in-out infinite' }, '⚛️'),
        h('div', { class: 'sub' }, 'Quantenkerne beim Sprung'),
        pend,
        h('div', { class: 'sub num', style: 'margin-top:6px' },
          `Mehr Sternenstaub = mehr Kerne (Wurzel aus ✨ / ${fmt(QUANTUM_BASE, false)})`),
        btn,
      ),
    );
    updaters.push(() => {
      const ok = canGalaxyJump(G.s);
      setText(pend, `+${fmt(pendingQuantum(G.s), false)} ⚛️`);
      setClass(btn, 'off', !ok);
    });
    el.appendChild(
      h('div', { class: 'card' },
        h('div', { class: 'kv' },
          h('span', null, 'Verfügbare Kerne'), h('span', { class: 'num q-c' }, fmt(s.quantum, false) + ' ⚛️'),
          h('span', null, 'Insgesamt'), h('span', { class: 'num' }, fmt(s.quantumEarned, false)),
          h('span', null, 'Passiver Bonus'), h('span', { class: 'num good-c' }, '+' + fmtPct(QUANTUM_PASSIVE * s.quantumEarned)),
          h('span', null, 'Galaxie-Sprünge'), h('span', { class: 'num' }, String(s.galaxyJumps)),
        ),
      ),
    );
    el.appendChild(h('div', { class: 'section-title' }, 'Quanten-Perks'));
    for (const p of QUANTUM_PERKS) {
      const lvl = qlvl(s, p.id);
      const maxed = lvl >= p.maxLevel;
      let right: HTMLElement;
      if (maxed) right = h('span', { class: 'owned-tag' }, 'MAX');
      else {
        const cost = p.cost(lvl);
        const b = h('button', { class: 'btn small cyan' }, `${fmt(cost, false)} ⚛️`);
        b.addEventListener('click', () => {
          if (buyQuantum(G.s, p.id)) {
            sfx.upgrade();
            haptic();
            burstAt(b, '#a5b4fc', 20, 'spark', 1);
          } else sfx.error();
        });
        updaters.push(() => setClass(b, 'off', cost > G.s.quantum));
        right = b;
      }
      el.appendChild(
        h('div', { class: 'card' + (lvl > 0 ? ' glow' : ''), style: '--c:#a5b4fc' },
          h('div', { class: 'row' },
            h('div', { class: 'icon-round' }, p.emoji),
            h('div', { class: 'col' },
              h('div', { class: 'title' }, p.name),
              h('div', { class: 'lab-level num', style: 'color:var(--quantum)' }, `Stufe ${lvl}/${p.maxLevel} · ${p.effect(lvl)}`),
              h('div', { class: 'sub' }, p.desc),
            ),
            right,
          ),
        ),
      );
    }
  }

  function update(): void {
    for (const u of updaters) u();
  }

  return { el, build, update, title: 'Kosmos' };
}

export function kosmosBadge(): boolean {
  const s = G.s;
  const p = pendingStardust(s);
  if (p >= Math.max(10, s.stardustEarned)) return true;
  // Labor-Knoten bezahlbar?
  for (const n of LAB_NODES) {
    const l = lab(s, n.id);
    if (l < n.maxLevel && labAvailable(s, n.id) && n.cost(l) <= s.stardust) return true;
  }
  return false;
}
