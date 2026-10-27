import { ARTIFACTS, ARTIFACT_INDEX, ARTIFACT_MAX_LEVEL, RARITY, type ArtifactDef } from '../../data/artifacts';
import { BUILDINGS } from '../../data/buildings';
import { CRATE_COST, EXPEDITIONS, MODULE_MAX, SHIP_MODULES, SHIP_NAMES } from '../../data/expeditions';
import { PLANETS } from '../../data/planets';
import {
  buyCrate, claimExpedition, destUnlocked, equipArtifact, expDuration, expSuccess, lootMult, missionAt, moduleCost,
  readyMissions, startExpedition, unequipArtifact, upgradeModule, type FoundArtifact, type Loot,
} from '../../core/fleet';
import { artifactSlots, fleetUnlocked, hangarSlots, HANGAR_UNLOCKS } from '../../core/rank';
import { fmt, fmtClock, fmtPct, fmtTime } from '../../core/format';
import { G } from '../ctx';
import { h, setClass, setScale, setText, clear } from '../dom';
import { burstAt, toast } from '../fx';
import { closeModal, showModal } from '../modal';
import { sfx, haptic } from '../../audio/sfx';
import type { Screen } from './types';

const SUBS = [
  { id: 'expeditionen', label: '🛰️ Expeditionen' },
  { id: 'artefakte', label: '🏺 Artefakte' },
  { id: 'werft', label: '🔧 Werft' },
];

export function artifactEffect(def: ArtifactDef, level: number): string {
  const v = def.v * level;
  const p = fmtPct(v);
  switch (def.kind) {
    case 'income': return `Einkommen +${p}`;
    case 'bld': return `${BUILDINGS[def.b ?? 0].emoji} ${BUILDINGS[def.b ?? 0].name} +${p}`;
    case 'offline': return `Offline-Ertrag +${p}`;
    case 'offcap': return `Offline-Dauer +${v} h`;
    case 'comet': return `Kometen ${p} häufiger`;
    case 'cometLuck': return `Kometen-Beute +${p}`;
    case 'gems': return `Kristalle +${p}`;
    case 'dust': return `Sternenstaub +${p}`;
    case 'discount': return `Baukosten −${fmtPct(Math.min(0.15, v))}`;
    case 'speed': return `Tempo +${p}`;
    case 'expSpeed': return `Expeditionen ${fmtPct(Math.min(0.5, v))} schneller`;
    case 'expLoot': return `Expeditions-Beute +${p}`;
    case 'expSuccess': return `Erfolgschance +${p}`;
    case 'em': return `Exotische Materie +${p}`;
  }
}

function artTile(def: ArtifactDef, owned: boolean, level: number, onClick?: () => void): HTMLElement {
  const el = h('button', { class: `art-tile rar-${def.rarity}${owned ? '' : ' unknown'}` },
    h('span', { class: 'art-e' }, owned ? def.emoji : '❔'),
    h('span', { class: 'art-n' }, owned ? def.name : RARITY[def.rarity].name),
    owned ? h('span', { class: 'art-l num' }, level >= ARTIFACT_MAX_LEVEL ? 'MAX' : `Stufe ${level}`) : null,
  );
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

function foundLine(f: FoundArtifact): HTMLElement {
  const def = ARTIFACT_INDEX[f.id];
  const tag = f.isNew ? 'NEU!' : f.converted ? `+${f.converted} ⚗️` : f.leveledUp ? `Stufe ${f.level} ⬆️` : `Splitter (Stufe ${f.level})`;
  return h('div', { class: `loot-art rar-${def.rarity}` },
    h('span', { class: 'art-e' }, def.emoji),
    h('div', { class: 'col' }, h('b', null, def.name), h('span', { class: 'sub' }, `${RARITY[def.rarity].name} · ${artifactEffect(def, f.level)}`)),
    h('span', { class: 'tag on' }, tag),
  );
}

/** Beute-Dialog nach einer Expedition */
export function showLoot(loot: Loot): void {
  const dest = EXPEDITIONS.find((e) => e.id === loot.dest);
  const rows = h('div', { class: 'kv', style: 'margin:8px 0' },
    h('span', null, '⚗️ Exotische Materie'), h('span', { class: 'num' }, '+' + fmt(loot.em, false)),
    loot.gems ? h('span', null, '💎 Kristalle') : null, loot.gems ? h('span', { class: 'num gem-c' }, '+' + loot.gems) : null,
    loot.dust ? h('span', null, '✨ Sternenstaub') : null, loot.dust ? h('span', { class: 'num dust-c' }, '+' + fmt(loot.dust, false)) : null,
    h('span', null, '⭐ Rang-XP'), h('span', { class: 'num' }, '+' + loot.xp),
  );
  const body: (string | Node)[] = [
    loot.success ? `Deine Crew kehrt von <b>${dest?.emoji} ${dest?.name}</b> zurück – mit vollem Laderaum!` : `Die Mission nach <b>${dest?.emoji} ${dest?.name}</b> ist gescheitert. Ein bisschen Beute konnte die Crew retten.`,
    rows,
    ...loot.artifacts.map(foundLine),
  ];
  showModal({
    hero: loot.success ? (loot.artifacts.length ? '🏺' : '📦') : '💥',
    title: loot.success ? 'Expedition erfolgreich!' : 'Expedition gescheitert',
    body,
    actions: [{ label: 'Super!', cls: loot.success ? 'green' : 'ghost' }],
  });
  if (loot.artifacts.some((a) => a.isNew || a.leveledUp)) sfx.achievement();
  else sfx.claim();
}

export function createFlotte(): Screen {
  const el = h('div', { class: 'screen' });
  let updaters: (() => void)[] = [];
  let readyKey = '';

  function build(): void {
    clear(el);
    updaters = [];
    const s = G.s;
    if (!fleetUnlocked(s)) {
      el.appendChild(h('div', { class: 'card nova-hero locked' },
        h('div', { style: 'font-size:60px' }, '🚀'),
        h('div', { class: 'title' }, 'Raumflotte'),
        h('div', { class: 'sub', style: 'margin-top:6px' }, 'Nach deiner ersten Supernova bekommst du ein Raumschiff. Schicke es auf Expeditionen – auch während du offline bist – und finde Exotische Materie und mächtige Artefakte.'),
      ));
      return;
    }
    const seg = h('div', { class: 'seg' });
    for (const sub of SUBS) {
      const b = h('button', null, sub.label);
      setClass(b, 'on', G.sub.flotte === sub.id);
      b.addEventListener('click', () => {
        G.sub.flotte = sub.id;
        sfx.click();
        haptic();
        build();
      });
      seg.appendChild(b);
    }
    el.appendChild(h('div', { class: 'sticky' }, seg));
    const em = h('span', { class: 'num' }, '');
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round', style: '--c:#34d399' }, '⚗️'),
        h('div', { class: 'col' }, h('div', { class: 'title' }, 'Exotische Materie'), h('div', { class: 'sub' }, 'Bringen deine Schiffe von Expeditionen mit. Damit rüstest du Schiffe auf und kaufst Artefakt-Kisten.')),
        h('div', { class: 'big-num good-c', style: 'font-size:20px' }, em),
      ),
    ));
    updaters.push(() => setText(em, fmt(G.s.fleet.em, false)));
    if (G.sub.flotte === 'artefakte') buildArtifacts();
    else if (G.sub.flotte === 'werft') buildShipyard();
    else buildExpeditions();
  }

  // ---- Expeditionen -----------------------------------------------------------
  function buildExpeditions(): void {
    const s = G.s;
    const ready = readyMissions(s, Date.now());
    if (ready >= 2) {
      const all = h('button', { class: 'btn block green' }, `📦 Alle ${ready} einsammeln`);
      all.addEventListener('click', () => {
        const loots: Loot[] = [];
        for (let i = 0; i < G.s.fleet.ships.length; i++) {
          const l = claimExpedition(G.s, i, Date.now());
          if (l) loots.push(l);
        }
        haptic();
        for (const l of loots) showLoot(l);
      });
      el.appendChild(all);
    }
    s.fleet.ships.forEach((ship, i) => {
      const m = missionAt(s, i);
      const name = `${SHIP_NAMES[i] ?? 'Schiff ' + (i + 1)}`;
      const modules = `🔥${ship.engine} 📦${ship.cargo} 🛡️${ship.shield}`;
      if (!m) {
        const btn = h('button', { class: 'btn small violet' }, '🚀 Ziel wählen');
        btn.addEventListener('click', () => destPicker(i));
        el.appendChild(h('div', { class: 'card' },
          h('div', { class: 'row' },
            h('div', { class: 'icon-round', style: '--c:#8b5cf6' }, '🛸'),
            h('div', { class: 'col' }, h('div', { class: 'title' }, name), h('div', { class: 'sub num' }, `Im Hangar · ${modules}`)),
            btn,
          ),
        ));
        return;
      }
      const d = EXPEDITIONS.find((e) => e.id === m.dest)!;
      const fill = h('i');
      const left = h('span', { class: 'num' }, '');
      const claim = h('button', { class: 'btn small green' }, '📦 Einsammeln');
      claim.addEventListener('click', () => {
        const loot = claimExpedition(G.s, i, Date.now());
        if (loot) {
          haptic();
          burstAt(claim, '#34d399', 26, 'spark', 1.2);
          showLoot(loot);
        }
      });
      const done = m.end <= Date.now();
      claim.style.display = done ? '' : 'none';
      const card = h('div', { class: 'card' + (done ? ' glow' : ''), style: '--c:#34d399' },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round', style: '--c:#22d3ee' }, d.emoji),
          h('div', { class: 'col' },
            h('div', { class: 'title' }, `${name} → ${d.name}`),
            h('div', { class: 'progress', style: 'margin-top:4px' }, fill),
            h('div', { class: 'sub num' }, left),
          ),
          claim,
        ),
      );
      el.appendChild(card);
      updaters.push(() => {
        const now = Date.now();
        const total = m.end - m.start;
        setScale(fill, total > 0 ? (now - m.start) / total : 1);
        const isDone = m.end <= now;
        setText(left, isDone ? '✅ Zurück im Hangar – Beute wartet!' : `⏳ noch ${fmtClock((m.end - now) / 1000)}`);
        if (isDone && claim.style.display === 'none') G.dirty = true;
      });
    });
    const slots = hangarSlots(s);
    const nextRank = HANGAR_UNLOCKS.find((l) => s.rank.level < l);
    el.appendChild(h('div', { class: 'hint', style: 'text-align:center;margin-top:4px' },
      `Hangar: ${slots} Schiff${slots === 1 ? '' : 'e'}. ${nextRank ? `Nächstes Schiff bei Rang ${nextRank}.` : ''} Ein weiteres gibt es für die Prüfung ⏱️ Countdown.`));
  }

  function destPicker(slot: number): void {
    const s = G.s;
    const list = h('div', { class: 'col', style: 'gap:8px' });
    for (const d of EXPEDITIONS) {
      const ok = destUnlocked(s, d);
      const row = h('button', { class: 'card dest' + (ok ? '' : ' locked') },
        h('div', { class: 'row' },
          h('span', { style: 'font-size:28px' }, d.emoji),
          h('div', { class: 'col', style: 'text-align:left' },
            h('div', { class: 'title' }, d.name),
            h('div', { class: 'sub num' }, ok
              ? `⏱ ${fmtTime(expDuration(s, slot, d))} · ✔ ${Math.round(expSuccess(s, slot, d) * 100)} % · ⚗️ ~${fmt(d.em * lootMult(s, slot), false)} · 🏺 ${Math.round(d.artifact * 100)} %`
              : `🔒 Erreiche zuerst ${PLANETS[d.minPlanet].emoji} ${PLANETS[d.minPlanet].name}`),
          ),
        ),
      );
      if (ok) {
        row.addEventListener('click', () => {
          if (startExpedition(G.s, slot, d.id, Date.now())) {
            sfx.manager();
            haptic();
            closeModal();
            toast(d.emoji, `${SHIP_NAMES[slot] ?? 'Schiff'} startet`, `Ziel: ${d.name} · zurück in ${fmtTime(expDuration(G.s, slot, d))}`);
          }
        });
      }
      list.appendChild(row);
    }
    showModal({
      hero: '🛰️',
      title: 'Wohin soll die Reise gehen?',
      body: ['Längere Reisen bringen mehr Exotische Materie und seltenere Artefakte. Die Zeit läuft auch, wenn die App geschlossen ist.', list],
      actions: [{ label: 'Abbrechen', cls: 'ghost' }],
    });
  }

  // ---- Artefakte --------------------------------------------------------------
  function buildArtifacts(): void {
    const s = G.s;
    const slots = artifactSlots(s);
    const found = ARTIFACTS.filter((a) => s.artifacts[a.id]).length;
    el.appendChild(h('div', { class: 'section-title' }, `Ausgerüstet (${s.equipped.length}/${slots})`));
    const eq = h('div', { class: 'art-grid' });
    for (let k = 0; k < slots; k++) {
      const id = s.equipped[k];
      if (id && ARTIFACT_INDEX[id]) eq.appendChild(artTile(ARTIFACT_INDEX[id], true, s.artifacts[id]?.level ?? 1, () => artifactDetail(id)));
      else eq.appendChild(h('div', { class: 'art-tile empty' }, h('span', { class: 'art-e' }, '➕'), h('span', { class: 'art-n' }, 'Freier Platz')));
    }
    el.appendChild(eq);
    el.appendChild(h('div', { class: 'hint' }, 'Nur ausgerüstete Artefakte wirken. Mehr Plätze gibt es mit steigendem Kommandanten-Rang (10/20/35/55/75).'));
    el.appendChild(h('div', { class: 'section-title' }, `Sammlung (${found}/${ARTIFACTS.length})`));
    const grid = h('div', { class: 'art-grid' });
    for (const a of ARTIFACTS) {
      const st = s.artifacts[a.id];
      grid.appendChild(artTile(a, !!st, st?.level ?? 0, st ? () => artifactDetail(a.id) : undefined));
    }
    el.appendChild(grid);
    el.appendChild(h('div', { class: 'hint' }, 'Doppelte Funde werden zu Splittern und verbessern das Artefakt bis Stufe 10. Artefakte bleiben bei Supernova und Galaxie-Sprung erhalten.'));
  }

  function artifactDetail(id: string): void {
    const s = G.s;
    const def = ARTIFACT_INDEX[id];
    const st = s.artifacts[id];
    if (!def || !st) return;
    const isEq = s.equipped.includes(id);
    const full = s.equipped.length >= artifactSlots(s);
    const max = st.level >= ARTIFACT_MAX_LEVEL;
    showModal({
      hero: def.emoji,
      title: def.name,
      body: [
        `<div style="text-align:center"><span class="tag rar-tag rar-${def.rarity}">${RARITY[def.rarity].name}</span></div>`,
        `<i class="hint">„${def.flavor}“</i>`,
        `<b>Stufe ${st.level}${max ? ' (Maximum)' : ''}:</b> ${artifactEffect(def, st.level)}`,
        max ? '' : `Nächste Stufe: ${artifactEffect(def, st.level + 1)} · Splitter ${st.shards}/${st.level}`,
      ].filter(Boolean),
      actions: [
        isEq
          ? { label: '📤 Ablegen', cls: 'ghost', onClick: () => void unequipArtifact(G.s, id) }
          : full
            ? { label: 'Alle Plätze belegt – lege zuerst eins ab', cls: 'ghost off' }
            : { label: '✨ Ausrüsten', cls: 'violet', onClick: () => { equipArtifact(G.s, id); sfx.upgrade(); } },
        { label: 'Schließen', cls: 'ghost' },
      ],
    });
  }

  // ---- Werft -------------------------------------------------------------------
  function buildShipyard(): void {
    const s = G.s;
    const crate = h('button', { class: 'btn small cyan' }, `${CRATE_COST} ⚗️`);
    crate.addEventListener('click', () => {
      const f = buyCrate(G.s);
      if (!f) {
        sfx.error();
        return;
      }
      haptic();
      burstAt(crate, RARITY[ARTIFACT_INDEX[f.id].rarity].color, 30, 'spark', 1.3);
      showModal({ hero: '🎁', title: 'Artefakt-Kiste geöffnet!', body: [foundLine(f)], actions: [{ label: 'Super!', cls: 'green' }] });
      sfx.achievement();
    });
    updaters.push(() => setClass(crate, 'off', G.s.fleet.em < CRATE_COST));
    el.appendChild(h('div', { class: 'card glow', style: '--c:#ffc94d' },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round', style: '--c:#ffc94d' }, '🎁'),
        h('div', { class: 'col' }, h('div', { class: 'title' }, 'Artefakt-Kiste'), h('div', { class: 'sub' }, 'Ein zufälliges Artefakt – mit etwas Glück sogar ein legendäres.')),
        crate,
      ),
    ));
    s.fleet.ships.forEach((ship, i) => {
      const rows = h('div', { class: 'col', style: 'gap:8px;margin-top:8px' });
      for (const mod of SHIP_MODULES) {
        const lvl = ship[mod.id];
        let right: HTMLElement;
        if (lvl >= MODULE_MAX) right = h('span', { class: 'owned-tag' }, 'MAX');
        else {
          const cost = moduleCost(lvl, mod.id, G.s);
          const b = h('button', { class: 'btn small' }, `${fmt(cost, false)} ⚗️`);
          b.addEventListener('click', () => {
            if (upgradeModule(G.s, i, mod.id)) {
              sfx.upgrade();
              haptic();
              burstAt(b, '#34d399', 16, 'spark', 0.9);
            } else sfx.error();
          });
          updaters.push(() => setClass(b, 'off', G.s.fleet.em < cost));
          right = b;
        }
        rows.appendChild(h('div', { class: 'row' },
          h('span', { style: 'font-size:22px' }, mod.emoji),
          h('div', { class: 'col' }, h('div', { style: 'font-weight:800' }, `${mod.name} ${lvl}/${MODULE_MAX}`), h('div', { class: 'sub' }, mod.desc(lvl))),
          right,
        ));
      }
      el.appendChild(h('div', { class: 'card' }, h('div', { class: 'title' }, `🛸 ${SHIP_NAMES[i] ?? 'Schiff ' + (i + 1)}`), rows));
    });
  }

  function update(): void {
    for (const u of updaters) u();
    const key = String(readyMissions(G.s, Date.now()));
    if (key !== readyKey) {
      if (readyKey !== '') G.dirty = true;
      readyKey = key;
    }
  }

  return { el, build, update, title: 'Flotte' };
}

export function flotteBadge(): boolean {
  const s = G.s;
  if (!fleetUnlocked(s)) return false;
  return readyMissions(s, Date.now()) > 0 || s.fleet.ships.some((_, i) => !missionAt(s, i));
}
