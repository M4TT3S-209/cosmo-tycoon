// Bot-Strategien für die Systeme von Version 3: Talente, Fähigkeiten, Funksprüche, Fraktions-Shop,
// Kolonien, Megaprojekte und Wochen-Auftrag. Bewusst einfach – so spielt ein durchschnittlich aktiver Spieler.
import { BRANCHES, TALENTS } from '../src/data/talents';
import { OFFERS } from '../src/data/factions';
import { EVENT_INDEX } from '../src/data/events';
import { COLONY_BUILDING_INDEX } from '../src/data/colonies';
import { MEGAPROJECTS } from '../src/data/megaprojects';
import { abilityReadyIn, commanderUnlocked, learnTalent, talentPointsFree, useAbility } from '../src/core/commander';
import { answerEvent, buyOffer, canPay, offerBought, offerPrice } from '../src/core/events';
import {
  RES_IDS, buildPlan, colonyReport, growPlan, megaBlock, resCap, startBuild, startGrow, startMega,
} from '../src/core/colonies';
import { claimWeekly } from '../src/core/weekly';
import type { GameState } from '../src/core/state';

type Mark = (key: string, msg: string) => void;

declare const process: { env: Record<string, string | undefined> };
/** NO=talente,faehigkeiten,funk,kolonien,mega: einzelne Strategien abschalten (zum Vergleichen) */
const OFF = new Set((process.env.NO ?? '').split(',').filter(Boolean));

/** Reihenfolge der Talent-Zweige: erst Einkommen, dann Wissenschaft, Glück, Flotte */
const BRANCH_ORDER = ['industrie', 'wissenschaft', 'glueck', 'flotte'];
const TALENT_ORDER = [...TALENTS].sort((a, b) => BRANCH_ORDER.indexOf(a.branch) - BRANCH_ORDER.indexOf(b.branch) || a.row - b.row);

function botTalents(s: GameState, mark: Mark): void {
  if (!commanderUnlocked(s)) return;
  for (let guard = 0; guard < 80 && talentPointsFree(s) > 0; guard++) {
    let learned = false;
    for (const t of TALENT_ORDER) {
      if (learnTalent(s, t.id)) {
        learned = true;
        mark('talent_' + t.id, `👤 Talent: ${t.name} (${BRANCHES.find((b) => b.id === t.branch)?.name})`);
        break;
      }
    }
    if (!learned) break;
  }
}

function botAbilities(s: GameState, nowMs: number): void {
  for (const id of s.commander.abilities) if (abilityReadyIn(s, id, nowMs) <= 0) useAbility(s, id, nowMs);
}

function botEvents(s: GameState, nowMs: number, rnd: () => number): void {
  while (s.events.queue.length) {
    const ev = EVENT_INDEX[s.events.queue[0].id];
    if (!ev) {
      s.events.queue.shift();
      continue;
    }
    // zufällige bezahlbare Entscheidung (Spieler entscheiden unterschiedlich)
    const ok = ev.choices.map((c, i) => [c, i] as const).filter(([c]) => canPay(s, c.cost, nowMs));
    const pick = ok.length ? ok[Math.floor(rnd() * ok.length)][1] : ev.choices.length - 1;
    answerEvent(s, 0, pick, nowMs, rnd);
  }
}

function botOffers(s: GameState, nowMs: number): void {
  for (const o of OFFERS) {
    if (offerBought(s, o.id, nowMs)) continue;
    const p = offerPrice(s, o.id);
    // Kristalle nur für Angebote ohne Kristall-Preis ausgeben (die spart der Bot für den Verdoppler)
    if (p.gems > 0 || p.em > s.fleet.em * 0.3) continue;
    buyOffer(s, o.id, nowMs);
  }
}

/** gewünschte Belegung leerer Bauplätze (je nach Kolonie-Stufe) */
const LAYOUT = ['mine', 'solar', 'kristall', 'deut', 'solar', 'schmiede', 'lager', 'chips', 'mine', 'solar', 'kristall', 'schmiede', 'chips', 'solar', 'deut', 'mine', 'solar'];

function sumCost(c: Partial<Record<string, number>>): number {
  let n = 0;
  for (const k in c) n += c[k] ?? 0;
  return n;
}

function botColonies(s: GameState, nowMs: number, mark: Mark): void {
  const limit = resCap(s);
  const full = RES_IDS.some((k) => s.res[k] >= limit * 0.9);
  for (const key in s.colonies) {
    const p = Number(key);
    const c = s.colonies[key];
    const g = growPlan(s, p);
    if (g && !g.block && c.slots.every(Boolean)) startGrow(s, p, nowMs);
    if (c.build) continue;
    const rep = colonyReport(s, p);
    // 1. leere Plätze füllen
    const empty = c.slots.findIndex((b) => !b);
    if (empty >= 0) {
      const used = c.slots.filter(Boolean).map((b) => b!.id);
      const want = LAYOUT.find((id, i) => {
        const have = used.filter((u) => u === id).length;
        const need = LAYOUT.slice(0, i + 1).filter((x) => x === id).length;
        return have < need && COLONY_BUILDING_INDEX[id].colonyLevel <= c.level;
      });
      if (want && startBuild(s, p, empty, want, nowMs)) {
        mark('colbuild', `🪐 Erster Kolonie-Bau: ${want}`);
        continue;
      }
    }
    // 2. Strom zuerst, Lager wenn voll, sonst das günstigste Upgrade
    let best = -1;
    let bestCost = Infinity;
    c.slots.forEach((b, i) => {
      if (!b) return;
      const plan = buildPlan(s, p, i);
      if (!plan || plan.block) return;
      let cost = sumCost(plan.cost);
      if (b.id === 'solar' && rep.energyProd < rep.energyUse * 1.15) cost *= 0.05;
      else if (COLONY_BUILDING_INDEX[b.id].energy < 0 && rep.energyProd < rep.energyUse * 1.15) cost *= 20;
      if (b.id === 'lager') cost *= full ? 0.1 : 3;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    });
    if (best >= 0) startBuild(s, p, best, undefined, nowMs);
  }
}

const MEGA_ORDER = ['dyson', 'terra', 'chrono', 'rechner', 'tor', 'archiv', 'boerse'];

function botMega(s: GameState, nowMs: number): void {
  if (s.mega.build) return;
  for (const id of MEGA_ORDER) {
    if (!MEGAPROJECTS.some((m) => m.id === id)) continue;
    if (megaBlock(s, id) === null && startMega(s, id, nowMs)) return;
  }
}

export function botV3(s: GameState, nowMs: number, mark: Mark, rnd: () => number = Math.random): void {
  if (!OFF.has('talente')) botTalents(s, mark);
  if (!OFF.has('faehigkeiten')) botAbilities(s, nowMs);
  if (!OFF.has('funk')) {
    botEvents(s, nowMs, rnd);
    botOffers(s, nowMs);
  } else s.events.queue.length = 0;
  if (!OFF.has('kolonien')) botColonies(s, nowMs, mark);
  if (!OFF.has('mega')) botMega(s, nowMs);
  if (claimWeekly(s, rnd)) mark('weekly' + s.weekly.key, `📅 Wochen-Auftrag ${s.weekly.key} erfüllt`);
}
