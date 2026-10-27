// Kolonien & Megaprojekte (Version 3)
import { PLANETS } from '../../data/planets';
import { BUILDING_MAX, COLONY_BUILDINGS, COLONY_BUILDING_INDEX, COLONY_LEVEL_MAX, COLONY_TRAITS, RES_META } from '../../data/colonies';
import { MEGAPROJECTS, MEGA_STAGES } from '../../data/megaprojects';
import {
  EXCHANGE_LOT, RES_IDS, buildPlan, buildTime, buildingOutput, claimDividend, colonyCanBuild, colonyReport, coloniesUnlocked, demolish,
  dividendReady, exchange, exchangeRate, growPlan, megaBlock, megaCostFor, megaTime, megaprojectsUnlocked, prosperityMult, resCap,
  startBuild, startGrow, startMega, totalColonyLevels, totalRates, type BuildBlock, type BuildingOutput,
} from '../../core/colonies';
import { dayKey } from '../../core/meta';
import { megaStage } from '../../core/talentfx';
import { fmt, fmtMult, fmtTime } from '../../core/format';
import type { ResId } from '../../core/state';
import { G } from '../ctx';
import { h, setClass, setScale, setText, clear, sphereEl } from '../dom';
import { burstAt, toast } from '../fx';
import { closeModal, showModal } from '../modal';
import { sfx, haptic } from '../../audio/sfx';
import { createGroup } from './group';
import type { Screen } from './types';

type ResMap = Partial<Record<ResId, number>>;

/** geöffnete Kolonie (Planet-Index) oder null = Übersicht */
let openColony: number | null = null;

const BLOCK_TEXT: Record<Exclude<BuildBlock, null>, string> = {
  busy: 'In dieser Kolonie wird schon gebaut',
  max: 'Höchste Stufe erreicht',
  level: 'Kolonie-Stufe zu niedrig',
  res: 'Nicht genug Rohstoffe',
  slot: 'Kein Bauplatz frei',
  empty: 'Bebaue zuerst alle Bauplätze dieser Kolonie',
};

/** Kosten als Text; fehlende Rohstoffe rot */
function costEl(cost: ResMap, extra?: { em?: number; time?: number }): HTMLElement {
  const s = G.s;
  const el = h('div', { class: 'cost-line' });
  for (const k of RES_IDS) {
    const v = cost[k];
    if (!v) continue;
    el.appendChild(h('span', { class: s.res[k] >= v ? '' : 'bad-c' }, `${RES_META[k].emoji} ${fmt(v, false)}`));
  }
  if (extra?.em) el.appendChild(h('span', { class: s.fleet.em >= extra.em ? '' : 'bad-c' }, `⚗️ ${fmt(extra.em, false)}`));
  if (extra?.time) el.appendChild(h('span', null, `⏱ ${fmtTime(extra.time)}`));
  return el;
}

function outputText(o: BuildingOutput): string {
  const parts: string[] = [];
  for (const k of RES_IDS) if (o.produce[k]) parts.push(`+${fmt(o.produce[k]!, false)} ${RES_META[k].emoji}/h`);
  for (const k of RES_IDS) if (o.consume[k]) parts.push(`−${fmt(o.consume[k]!, false)} ${RES_META[k].emoji}/h`);
  if (o.energy) parts.push(`${o.energy > 0 ? '+' : '−'}${fmt(Math.abs(o.energy), false)} ⚡`);
  if (o.storage) parts.push(`+${fmt(o.storage, false)} 📦 Lager`);
  return parts.join(' · ');
}

function planetName(p: number): string {
  return PLANETS[p]?.name ?? `Planet ${p + 1}`;
}

/** Rohstoff-Leiste: Bestand, Lager-Füllung, Produktion pro Stunde */
function createResBar(): { el: HTMLElement; update: () => void } {
  const cells: { k: ResId; amount: HTMLElement; rate: HTMLElement; fill: HTMLElement }[] = [];
  const capEl = h('span', { class: 'num' }, '');
  const grid = h('div', { class: 'res-grid' });
  for (const k of RES_IDS) {
    const amount = h('b', { class: 'num' }, '');
    const rate = h('small', { class: 'num' }, '');
    const fill = h('i');
    cells.push({ k, amount, rate, fill });
    grid.appendChild(h('div', { class: 'res-cell', title: RES_META[k].name },
      h('span', { class: 'res-emoji' }, RES_META[k].emoji), amount, rate, h('div', { class: 'progress thin' }, fill)));
  }
  const el = h('div', { class: 'sticky' }, h('div', { class: 'card res-bar' }, grid, h('div', { class: 'hint res-cap' }, '📦 Lager: ', capEl, ' je Rohstoff')));
  let t = 1;
  function update(): void {
    t += 1;
    if (t < 6) return; // ~10× pro Sekunde reicht
    t = 0;
    const s = G.s;
    const limit = resCap(s);
    const rates = totalRates(s);
    for (const c of cells) {
      setText(c.amount, fmt(s.res[c.k], false));
      const r = rates[c.k];
      setText(c.rate, r === 0 ? '–' : `${r > 0 ? '+' : '−'}${fmt(Math.abs(r), false)}/h`);
      setClass(c.rate, 'bad-c', r < 0);
      setScale(c.fill, Math.min(1, s.res[c.k] / limit));
      setClass(c.fill, 'full', s.res[c.k] >= limit);
    }
    setText(capEl, fmt(limit, false));
  }
  update();
  return { el, update };
}

// ---- Bau-Menüs ----------------------------------------------------------------------

function toastBuildStarted(p: number, id: string, to: number): void {
  const d = COLONY_BUILDING_INDEX[id];
  sfx.buy();
  haptic();
  toast(d.emoji, to > 1 ? `${d.name}: Ausbau auf Stufe ${to}` : `${d.name} wird gebaut`, `Kolonie ${planetName(p)}`);
}

/** Leerer Bauplatz: Auswahl aller Gebäude */
function openBuildMenu(p: number, slot: number): void {
  const s = G.s;
  const c = s.colonies[String(p)];
  if (!c) return;
  const list = h('div', { class: 'build-list' });
  for (const d of COLONY_BUILDINGS) {
    const plan = buildPlan(s, p, slot, d.id);
    if (!plan) continue;
    const out = buildingOutput(s, p, d.id, 1);
    let right: HTMLElement;
    if (plan.block === 'level') right = h('span', { class: 'tag' }, `🔒 Kolonie-Stufe ${d.colonyLevel}`);
    else {
      const btn = h('button', { class: 'btn small green' + (plan.block ? ' off' : '') }, 'Bauen');
      btn.addEventListener('click', () => {
        if (startBuild(G.s, p, slot, d.id, Date.now())) {
          closeModal();
          toastBuildStarted(p, d.id, 1);
        } else {
          sfx.error();
          toast(d.emoji, plan.block ? BLOCK_TEXT[plan.block] : 'Geht gerade nicht');
        }
      });
      right = btn;
    }
    list.appendChild(h('div', { class: 'row build-opt' + (plan.block === 'level' ? ' locked' : '') },
      h('span', { class: 'build-emoji' }, d.emoji),
      h('div', { class: 'col' },
        h('div', { style: 'font-weight:800' }, d.name),
        h('div', { class: 'sub' }, d.desc),
        h('div', { class: 'sub good-c' }, outputText(out)),
        costEl(plan.cost, { time: plan.time }),
      ),
      right,
    ));
  }
  showModal({
    hero: '🏗️',
    title: `Bauplatz ${slot + 1} · ${planetName(p)}`,
    body: [c.build ? h('p', { class: 'hint' }, '⏳ In dieser Kolonie läuft schon ein Bau – du kannst erst danach den nächsten starten.') : '', list].filter(Boolean) as (string | Node)[],
    actions: [{ label: 'Schließen', cls: 'ghost' }],
  });
}

/** Gebautes Gebäude: Werte, Ausbau, Abriss */
function openBuildingSheet(p: number, slot: number): void {
  const s = G.s;
  const c = s.colonies[String(p)];
  const b = c?.slots[slot];
  if (!c || !b) return;
  const d = COLONY_BUILDING_INDEX[b.id];
  if (!d) return;
  const plan = buildPlan(s, p, slot);
  const now = buildingOutput(s, p, b.id, b.level);
  const body: (string | Node)[] = [h('p', { class: 'hint', style: 'text-align:center' }, d.desc)];
  const kv = h('div', { class: 'kv' }, h('span', null, `Stufe ${b.level}`), h('span', null, outputText(now) || '–'));
  if (b.level < BUILDING_MAX) kv.append(h('span', null, `Stufe ${b.level + 1}`), h('span', { class: 'good-c' }, outputText(buildingOutput(s, p, b.id, b.level + 1)) || '–'));
  body.push(kv);
  if (plan && plan.block !== 'max') {
    body.push(h('div', { class: 'section-title' }, 'Ausbau'), costEl(plan.cost, { time: plan.time }));
    if (plan.block) body.push(h('p', { class: 'hint' }, BLOCK_TEXT[plan.block]));
  }
  showModal({
    hero: d.emoji,
    title: `${d.name} · Stufe ${b.level}`,
    body,
    actions: [
      ...(plan && plan.block !== 'max'
        ? [{
          label: `⬆️ Auf Stufe ${plan.to} ausbauen`,
          cls: 'green' + (plan.block ? ' off' : ''),
          onClick: () => {
            if (startBuild(G.s, p, slot, undefined, Date.now())) toastBuildStarted(p, b.id, plan.to);
            else {
              sfx.error();
              return false;
            }
          },
        }]
        : []),
      {
        label: '🧨 Abreißen',
        cls: 'ghost',
        onClick: () => {
          showModal({
            hero: '🧨',
            title: `${d.name} abreißen?`,
            body: [`Der Bauplatz wird frei. Die Rohstoffe für <b>Stufe ${b.level}</b> bekommst du <b>nicht</b> zurück.`],
            actions: [
              { label: '🧨 Abreißen', cls: 'red', onClick: () => { if (demolish(G.s, p, slot)) { sfx.click(); toast('🧨', `${d.name} abgerissen`, `Kolonie ${planetName(p)}`); } } },
              { label: 'Abbrechen', cls: 'ghost' },
            ],
          });
        },
      },
      { label: 'Schließen', cls: 'ghost' },
    ],
  });
}

// ---- Kolonien ------------------------------------------------------------------------

function createKolonienList(): Screen {
  const el = h('div', { class: 'screen' });
  let bar = createResBar();
  let tickers: (() => void)[] = [];

  function colonyKeys(): number[] {
    return Object.keys(G.s.colonies).map(Number).sort((a, b) => a - b);
  }

  function buildOverview(): void {
    const s = G.s;
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'title' }, '🪐 Deine Kolonien'),
      h('div', { class: 'sub', style: 'margin-top:4px' }, 'Jede Kolonie produziert Rohstoffe – rund um die Uhr, auch offline, bis das Lager voll ist. Pro Kolonie läuft immer ein Bau gleichzeitig.'),
      h('div', { class: 'sub', style: 'margin-top:6px' }, '🏙️ Wohlstand: ', h('b', { class: 'num gold-c' }, fmtMult(prosperityMult(s))), ` Einkommen (+0,5 % je Ausbau-Stufe, bisher ${totalColonyLevels(s)})`),
    ));
    for (const p of colonyKeys()) {
      const c = s.colonies[String(p)];
      const planet = PLANETS[p];
      const status = h('div', { class: 'sub num' }, '');
      const badge = h('span', { class: 'badge dot' });
      const card = h('div', { class: 'card colony-card tappable' },
        h('div', { class: 'row' },
          planet ? sphereEl(planet, 'col-sphere') : h('div', { class: 'icon-round' }, '🪐'),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, `${planet?.emoji ?? '🪐'} ${planetName(p)} `, h('span', { class: 'tag' }, `Stufe ${c.level}`)),
            h('div', { class: 'trait' }, COLONY_TRAITS[p]?.text ?? ''),
            status,
          ),
          h('span', { class: 'chev' }, '›'),
        ),
        badge,
      );
      card.addEventListener('click', () => {
        openColony = p;
        sfx.click();
        haptic();
        G.dirty = true;
      });
      el.appendChild(card);
      tickers.push(() => {
        const r = colonyReport(G.s, p);
        const used = c.slots.filter(Boolean).length;
        const parts = [`🏗️ ${used}/${c.slots.length} Plätze`, `⚡ ${fmt(r.energyProd, false)}/${fmt(r.energyUse, false)}`];
        if (c.build) {
          const d = COLONY_BUILDING_INDEX[c.build.id];
          parts.push(`⏳ ${d?.emoji ?? ''} ${fmtTime(Math.max(0, (c.build.end - G.now) / 1000))}`);
        }
        if (c.grow) parts.push(`🏙️ ${fmtTime(Math.max(0, (c.grow - G.now) / 1000))}`);
        setText(status, parts.join(' · '));
        setClass(status, 'bad-c', r.eff < 1);
        setClass(badge, 'on', colonyCanBuild(G.s, p));
      });
    }
  }

  function buildDetail(p: number): void {
    const s = G.s;
    const c = s.colonies[String(p)];
    const planet = PLANETS[p];
    const back = h('button', { class: 'btn small ghost' }, '‹ Alle Kolonien');
    back.addEventListener('click', () => {
      openColony = null;
      sfx.click();
      G.dirty = true;
    });
    el.appendChild(h('div', { class: 'row', style: 'justify-content:space-between' }, back, h('span', { class: 'hint' }, `Kolonie ${colonyKeys().indexOf(p) + 1} von ${colonyKeys().length}`)));

    // Kopf: Planet, Energie, Produktion
    const energyFill = h('i');
    const energyText = h('div', { class: 'sub num' }, '');
    const prodText = h('div', { class: 'sub num good-c' }, '');
    el.appendChild(h('div', { class: 'card glow colony-head', style: `--c:${planet?.glow ?? '#8b5cf6'}` },
      h('div', { class: 'row' },
        planet ? sphereEl(planet, 'col-sphere big') : null,
        h('div', { class: 'col' },
          h('div', { class: 'title' }, `${planet?.emoji ?? '🪐'} ${planetName(p)} · Stufe ${c.level}`),
          h('div', { class: 'trait' }, '⭐ ' + (COLONY_TRAITS[p]?.text ?? '')),
          c.level > 1 ? h('div', { class: 'sub' }, `+${(c.level - 1) * 10} % Produktion durch die Kolonie-Stufe`) : null,
        ),
      ),
      h('div', { class: 'section-title', style: 'margin:10px 0 4px' }, '⚡ Energie'),
      h('div', { class: 'progress energy' }, energyFill),
      energyText,
      prodText,
    ));
    tickers.push(() => {
      const r = colonyReport(G.s, p);
      setScale(energyFill, r.energyProd <= 0 ? (r.energyUse > 0 ? 1 : 0) : Math.min(1, r.energyUse / r.energyProd));
      setClass(energyFill, 'deficit', r.eff < 1);
      setText(energyText, r.eff < 1
        ? `⚠️ Strommangel: ${fmt(r.energyProd, false)} erzeugt, ${fmt(r.energyUse, false)} gebraucht – alles läuft mit ${Math.round(r.eff * 100)} %. Baue ein Kraftwerk!`
        : `${fmt(r.energyProd, false)} erzeugt · ${fmt(r.energyUse, false)} gebraucht`);
      setClass(energyText, 'bad-c', r.eff < 1);
      const parts: string[] = [];
      for (const k of RES_IDS) {
        const v = r.rate[k];
        if (Math.abs(v) >= 0.5) parts.push(`${v > 0 ? '+' : '−'}${fmt(Math.abs(v), false)} ${RES_META[k].emoji}`);
      }
      const producers = c.slots.some((b) => b && COLONY_BUILDING_INDEX[b.id]?.produce);
      setText(prodText, parts.length ? parts.join(' · ') + ' pro Stunde' : producers ? 'Ohne Energie steht die Produktion still.' : 'Noch keine Produktion – bau eine Mine!');
    });

    // Bau läuft
    if (c.build) {
      const b = c.build;
      const d = COLONY_BUILDING_INDEX[b.id];
      const fill = h('i');
      const left = h('span', { class: 'num' }, '');
      const total = buildTime(p, b.id, b.to);
      el.appendChild(h('div', { class: 'card build-run' },
        h('div', { class: 'row' }, h('span', { class: 'build-emoji spin-slow' }, '🏗️'),
          h('div', { class: 'col' }, h('div', { class: 'title' }, `${d?.emoji ?? ''} ${d?.name ?? b.id} → Stufe ${b.to}`), h('div', { class: 'sub' }, 'Fertig in ', left))),
        h('div', { class: 'progress' }, fill),
      ));
      tickers.push(() => {
        const rest = Math.max(0, (b.end - G.now) / 1000);
        setText(left, fmtTime(rest));
        setScale(fill, total > 0 ? 1 - rest / total : 1);
      });
    }

    // Bauplätze
    el.appendChild(h('div', { class: 'section-title' }, `🏗️ Bauplätze (${c.slots.filter(Boolean).length}/${c.slots.length})`));
    const grid = h('div', { class: 'slot-grid' });
    c.slots.forEach((b, i) => {
      const busy = c.build?.slot === i;
      const d = b ? COLONY_BUILDING_INDEX[b.id] : null;
      const bd = busy ? COLONY_BUILDING_INDEX[c.build!.id] : null;
      const tile = h('button', { class: 'slot' + (b ? '' : ' empty') + (busy ? ' busy' : '') },
        h('span', { class: 'slot-emoji' }, d?.emoji ?? (busy ? bd?.emoji ?? '🏗️' : '＋')),
        h('span', { class: 'slot-name' }, d?.name ?? (busy ? bd?.name ?? '' : 'Frei')),
        h('span', { class: 'slot-lv num' }, b ? `Stufe ${b.level}${busy ? ' → ' + c.build!.to : ''}` : busy ? 'im Bau' : 'Bauen'),
      );
      tile.addEventListener('click', () => {
        sfx.click();
        haptic();
        if (b) openBuildingSheet(p, i);
        else if (busy) toast('🏗️', 'Wird gerade gebaut', 'Bitte etwas Geduld …');
        else openBuildMenu(p, i);
      });
      grid.appendChild(tile);
    });
    el.appendChild(grid);

    // Kolonie ausbauen
    const g = growPlan(s, p);
    if (g) {
      const btn = h('button', { class: 'btn small violet' }, c.grow ? '⏳ Läuft' : '🏙️ Ausbauen');
      const left = h('div', { class: 'sub num' }, '');
      btn.addEventListener('click', () => {
        if (startGrow(G.s, p, Date.now())) {
          sfx.upgrade();
          haptic();
          burstAt(btn, '#c084fc', 22, 'spark', 1);
          toast('🏙️', `Kolonie ${planetName(p)} wird ausgebaut`, `Fertig in ${fmtTime(g.time)}`);
        } else {
          sfx.error();
          toast('🏙️', g.block ? BLOCK_TEXT[g.block] : 'Geht gerade nicht');
        }
      });
      const next = c.level + 1;
      const unlocks = COLONY_BUILDINGS.filter((d) => d.colonyLevel === next).map((d) => `${d.emoji} ${d.name}`);
      el.appendChild(h('div', { class: 'card' + (c.level >= COLONY_LEVEL_MAX ? ' glow' : '') },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round', style: '--c:#c084fc' }, '🏙️'),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, c.level >= COLONY_LEVEL_MAX ? 'Voll ausgebaut' : `Kolonie-Stufe ${next}`),
            c.level < COLONY_LEVEL_MAX ? h('div', { class: 'sub' }, ['+1 Bauplatz', '+10 % Produktion', unlocks.length ? 'neu: ' + unlocks.join(', ') : ''].filter(Boolean).join(' · ')) : null,
            c.level < COLONY_LEVEL_MAX && !c.grow ? costEl(g.cost, { time: g.time }) : null,
            g.block === 'empty' ? h('div', { class: 'hint' }, '🏗️ ' + BLOCK_TEXT.empty) : null,
            left,
          ),
          c.level < COLONY_LEVEL_MAX ? btn : null,
        ),
      ));
      tickers.push(() => {
        setClass(btn, 'off', growPlan(G.s, p)?.block !== null);
        setText(left, c.grow ? `⏳ Fertig in ${fmtTime(Math.max(0, (c.grow - G.now) / 1000))}` : '');
      });
    }
  }

  function build(): void {
    clear(el);
    tickers = [];
    bar = createResBar();
    el.appendChild(bar.el);
    if (openColony !== null && !G.s.colonies[String(openColony)]) openColony = null;
    if (openColony === null) buildOverview();
    else buildDetail(openColony);
    update();
  }

  let t = 0;
  function update(): void {
    bar.update();
    t += 1;
    if (t < 6) return;
    t = 0;
    for (const f of tickers) f();
  }

  return { el, build, update, title: 'Kolonien' };
}

// ---- Megaprojekte ----------------------------------------------------------------------

function createMegaprojekte(): Screen {
  const el = h('div', { class: 'screen' });
  let bar = createResBar();
  let tickers: (() => void)[] = [];

  function build(): void {
    clear(el);
    tickers = [];
    const s = G.s;
    if (!megaprojectsUnlocked(s)) {
      el.appendChild(h('div', { class: 'card nova-hero locked' },
        h('div', { style: 'font-size:60px' }, '🏗️'),
        h('div', { class: 'title' }, 'Megaprojekte'),
        h('div', { class: 'sub', style: 'margin-top:6px' }, 'Ab dem Jupiter kannst du gigantische Bauwerke errichten: Dyson-Schwarm, Sternentor, Quantenrechner und mehr. Sie verändern das ganze Spiel.'),
      ));
      return;
    }
    bar = createResBar();
    el.appendChild(bar.el);
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'title' }, '🏗️ Megaprojekte'),
      h('div', { class: 'sub', style: 'margin-top:4px' }, `Riesige Bauwerke in ${MEGA_STAGES} Stufen. Es wird immer nur eins gleichzeitig gebaut – die Bauzeit (1 bis 24 Stunden) läuft auch offline weiter. Bezahlt wird mit Rohstoffen und ⚗️ Exotischer Materie aus der Flotte.`),
    ));

    const run = s.mega.build;
    if (run) {
      const m = MEGAPROJECTS.find((x) => x.id === run.id);
      const fill = h('i');
      const left = h('span', { class: 'num' }, '');
      const total = megaTime(run.stage);
      el.appendChild(h('div', { class: 'card glow build-run', style: '--c:#fbbf24' },
        h('div', { class: 'row' }, h('span', { class: 'build-emoji spin-slow' }, m?.emoji ?? '🏗️'),
          h('div', { class: 'col' }, h('div', { class: 'title' }, `${m?.name ?? run.id}: Stufe ${run.stage} im Bau`), h('div', { class: 'sub' }, 'Fertig in ', left))),
        h('div', { class: 'progress' }, fill),
      ));
      tickers.push(() => {
        const rest = Math.max(0, (run.end - G.now) / 1000);
        setText(left, fmtTime(rest));
        setScale(fill, 1 - rest / total);
      });
    }

    for (const m of MEGAPROJECTS) {
      const stage = megaStage(s, m.id);
      const next = stage + 1;
      const building = run?.id === m.id;
      const pips = h('div', { class: 'pips' }, ...Array.from({ length: MEGA_STAGES }, (_, i) => h('i', { class: i < stage ? 'on' : building && i === stage ? 'run' : '' })));
      const stages = h('div', { class: 'perk-list' }, ...m.stages.map((txt, i) =>
        h('div', { class: 'perk' + (i < stage ? ' on' : '') }, i < stage ? '✅ ' : i === stage ? '▶️ ' : '🔒 ', `Stufe ${i + 1}: ${txt}`)));
      const card = h('div', { class: 'card mega' + (stage > 0 ? ' glow' : ''), style: '--c:#fbbf24' },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round', style: '--c:#fbbf24' }, m.emoji),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, m.name, ' ', h('span', { class: 'tag' + (stage >= MEGA_STAGES ? ' on' : '') }, `${stage}/${MEGA_STAGES}`)),
            h('div', { class: 'sub' }, m.desc),
          ),
        ),
        pips,
        stages,
      );
      if (next <= MEGA_STAGES && !building) {
        const cost = megaCostFor(s, m.id, next);
        const btn = h('button', { class: 'btn block violet', style: 'margin-top:8px' }, `🏗️ Stufe ${next} bauen`);
        btn.addEventListener('click', () => {
          const block = megaBlock(G.s, m.id);
          if (startMega(G.s, m.id, Date.now())) {
            sfx.upgrade();
            haptic();
            burstAt(btn, '#fbbf24', 30, 'spark', 1.2);
            toast(m.emoji, `${m.name}: Stufe ${next} im Bau`, `Fertig in ${fmtTime(megaTime(next))}`, true);
          } else {
            sfx.error();
            toast(m.emoji, block === 'busy' ? 'Es wird schon ein Megaprojekt gebaut' : 'Nicht genug Rohstoffe oder ⚗️');
          }
        });
        card.append(h('div', { class: 'section-title', style: 'margin:10px 0 4px' }, `Kosten für Stufe ${next}`), costEl(cost.res, { em: cost.em, time: megaTime(next) }), btn);
        tickers.push(() => setClass(btn, 'off', megaBlock(G.s, m.id) !== null));
      }
      el.appendChild(card);
    }

    // Börse
    const boerse = megaStage(s, 'boerse');
    if (boerse > 0) {
      const rate = exchangeRate(s);
      const list = h('div', { class: 'offer-list' });
      for (const k of ['metal', 'crystal', 'deut'] as ResId[]) {
        const btn = h('button', { class: 'btn small cyan' }, `→ ${fmt(rate, false)} ⚗️`);
        btn.addEventListener('click', () => {
          if (exchange(G.s, k)) {
            sfx.claim();
            haptic();
            burstAt(btn, '#22d3ee', 16, 'spark', 0.8);
          } else {
            sfx.error();
            toast('💱', `Du brauchst ${fmt(EXCHANGE_LOT, false)} ${RES_META[k].name}`);
          }
        });
        tickers.push(() => setClass(btn, 'off', G.s.res[k] < EXCHANGE_LOT));
        list.appendChild(h('div', { class: 'row offer' },
          h('span', { style: 'font-size:22px' }, RES_META[k].emoji),
          h('div', { class: 'col' }, h('div', { style: 'font-weight:800' }, `${fmt(EXCHANGE_LOT, false)} ${RES_META[k].name}`)),
          btn,
        ));
      }
      const card = h('div', { class: 'card glow', style: '--c:#22d3ee' },
        h('div', { class: 'title' }, '💱 Galaktische Börse'),
        h('div', { class: 'sub', style: 'margin:4px 0 8px' }, 'Tausche überzählige Grundstoffe gegen Exotische Materie. Bessere Kurse mit jeder Börsen-Stufe.'),
        list,
      );
      if (boerse >= MEGA_STAGES) {
        const btn = h('button', { class: 'btn block green', style: 'margin-top:10px' }, '📈 Dividende abholen: 50 💎');
        btn.addEventListener('click', () => {
          const n = claimDividend(G.s, dayKey(Date.now()));
          if (n) {
            sfx.gems();
            haptic();
            burstAt(btn, '#7dd3fc', 26, 'spark', 1);
            toast('📈', `Dividende: +${n} 💎`, 'Morgen gibt es die nächste.', true);
          } else sfx.error();
        });
        tickers.push(() => {
          const ready = dividendReady(G.s, dayKey(G.now));
          setClass(btn, 'off', !ready);
          setText(btn, ready ? '📈 Dividende abholen: 50 💎' : '📈 Dividende morgen wieder');
        });
        card.appendChild(btn);
      }
      el.appendChild(card);
    }
    update();
  }

  let t = 0;
  function update(): void {
    bar.update();
    t += 1;
    if (t < 6) return;
    t = 0;
    for (const f of tickers) f();
  }

  return { el, build, update, title: 'Megaprojekte' };
}

/** Megaprojekt jetzt baubar oder Dividende bereit? */
function megaBadge(): boolean {
  const s = G.s;
  if (!megaprojectsUnlocked(s)) return false;
  if (dividendReady(s, dayKey(G.now))) return true;
  return !s.mega.build && MEGAPROJECTS.some((m) => megaBlock(s, m.id) === null);
}

function coloniesCanBuild(): boolean {
  const s = G.s;
  for (const k in s.colonies) if (colonyCanBuild(s, Number(k))) return true;
  return false;
}

export function createKolonien(): Screen {
  const el = h('div', { class: 'screen' });
  const group = createGroup('kolonien', 'Kolonien', [
    { id: 'kolonien', label: '🪐 Kolonien', screen: createKolonienList(), badge: coloniesCanBuild },
    { id: 'mega', label: '🏗️ Megaprojekte', screen: createMegaprojekte(), badge: megaBadge },
  ]);
  let locked = true;

  function build(): void {
    clear(el);
    locked = !coloniesUnlocked(G.s);
    if (locked) {
      el.appendChild(h('div', { class: 'card nova-hero locked' },
        h('div', { style: 'font-size:60px' }, '🪐'),
        h('div', { class: 'title' }, 'Kolonien'),
        h('div', { class: 'sub', style: 'margin-top:6px' }, 'Erreiche mit einer Supernova den Mars – dann kannst du deine Planeten besiedeln.'),
      ));
      return;
    }
    group.build();
    el.appendChild(group.el);
  }

  function update(dt: number): void {
    if (locked) {
      if (coloniesUnlocked(G.s)) G.dirty = true;
      return;
    }
    group.update(dt);
  }

  return { el, build, update, title: 'Kolonien' };
}

export function koloniesBadge(): boolean {
  return coloniesUnlocked(G.s) && (coloniesCanBuild() || megaBadge());
}
