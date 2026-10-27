// Funksprüche (Ereignisse mit Entscheidungen), Fraktions-Ruf und Fraktions-Shop (Version 3)
import { RARITY, RARITY_ORDER, type Rarity } from '../data/artifacts';
import { ARTIFACT_INDEX } from '../data/artifacts';
import { RES_META } from '../data/colonies';
import { EVENTS, EVENT_INDEX, type ChoiceDef, type Cost, type Effect, type EventDef } from '../data/events';
import { FACTION_INDEX, OFFERS, REP_NAMES, repLevel, type FactionId } from '../data/factions';
import { addBoost, addGems, earn, timeWarp } from './actions';
import { emit } from './bus';
import { addResources, emScale, hasResources, payResources, resScale } from './colonies';
import { compute, newCalc } from './economy';
import { addEm, bestPlanet, grantArtifact, randomArtifactOf } from './fleet';
import { fmt, fmtTime } from './format';
import { weekKey } from './meta';
import { addXp, xpForNext } from './rank';
import { cap } from './safe';
import { talentBonus } from './talentfx';
import type { GameState, ResId } from './state';

export const EVENT_QUEUE_MAX = 3;
/** Faktor für XP-Belohnungen (Anteil an einem Kommandanten-Level) */
const EVENT_XP_SCALE = 0.25;
/** offline kommt höchstens alle 2 Stunden ein Funkspruch an */
const OFFLINE_EVENT_SEC = 7200;

export function eventsUnlocked(s: GameState): boolean {
  return s.totalSupernovas >= 1 || s.galaxyJumps > 0;
}

/** Sekunden aktiven Spiels bis zum nächsten Funkspruch */
export function eventInterval(s: GameState, rnd: () => number = Math.random): number {
  return (480 + rnd() * 420) / talentBonus(s).eventFreq;
}

const calc = newCalc();
/** Wert einer Sekunde Einkommen für Funksprüche (auch ohne Manager nie null) */
function incomeRate(s: GameState, now: number): number {
  const c = compute(s, now, calc);
  return Math.max(c.baseIncome, c.potential * 0.25, 10);
}

function pickEvent(s: GameState, rnd: () => number): EventDef | null {
  const planet = bestPlanet(s);
  const queued = new Set(s.events.queue.map((q) => q.id));
  const pool = EVENTS.filter((e) => !e.chainOnly && (e.minPlanet ?? 0) <= planet && !queued.has(e.id) && !(e.id in s.events.chains));
  let sum = 0;
  const weights = pool.map((e) => {
    const w = (e.weight ?? 1) / (1 + 0.6 * (s.events.seen[e.id] ?? 0));
    sum += w;
    return w;
  });
  let r = rnd() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1] ?? null;
}

export function pushEvent(s: GameState, id: string, now: number): boolean {
  if (s.events.queue.length >= EVENT_QUEUE_MAX || !EVENT_INDEX[id]) return false;
  s.events.queue.push({ id, at: now });
  emit('eventArrived', { id });
  return true;
}

/** Jeden Frame: aktive Spielzeit zählt bis zum nächsten Funkspruch herunter */
export function tickEvents(s: GameState, dt: number, now: number, rnd: () => number = Math.random): void {
  if (!eventsUnlocked(s)) return;
  s.events.nextIn -= dt;
  if (s.events.nextIn > 0) return;
  s.events.nextIn = eventInterval(s, rnd);
  const ev = pickEvent(s, rnd);
  if (ev) pushEvent(s, ev.id, now);
}

/** Fällige Fortsetzungen von Ketten in die Warteschlange stellen */
export function checkChains(s: GameState, now: number): void {
  for (const id in s.events.chains) {
    if (s.events.chains[id] > now || s.events.queue.length >= EVENT_QUEUE_MAX) continue;
    delete s.events.chains[id];
    pushEvent(s, id, now);
  }
}

/** Während der Abwesenheit eingetroffene Funksprüche (höchstens bis die Warteschlange voll ist) */
export function offlineEvents(s: GameState, seconds: number, now: number, rnd: () => number = Math.random): number {
  if (!eventsUnlocked(s)) return 0;
  checkChains(s, now);
  let n = Math.floor(seconds / OFFLINE_EVENT_SEC);
  let added = 0;
  while (n-- > 0 && s.events.queue.length < EVENT_QUEUE_MAX) {
    const ev = pickEvent(s, rnd);
    if (!ev || !pushEvent(s, ev.id, now)) break;
    added++;
  }
  return added;
}

// ---- Kosten & Chancen ----------------------------------------------------------

function scaledRes(s: GameState, r: Partial<Record<ResId, number>>, mult = 1): Partial<Record<ResId, number>> {
  const out: Partial<Record<ResId, number>> = {};
  const k = resScale(s) * mult;
  for (const id in r) out[id as ResId] = Math.round((r[id as ResId] ?? 0) * k);
  return out;
}

/**
 * Geldkosten werden nicht sofort abgebucht (der Auto-Käufer hält kaum Geld vor), sondern abgestottert:
 * doppelt so lange halbes Einkommen – entspricht genau `cashSec` Sekunden Einkommen.
 */
export const PAYMENT_MULT = 0.5;

/** tatsächliche Kosten einer Entscheidung (Materie wächst mit dem Fortschritt) */
export function choiceCost(s: GameState, c: Cost, _now: number): { paySec: number; gems: number; em: number; res: Partial<Record<ResId, number>> } {
  return {
    paySec: c.cashSec ? c.cashSec / (1 - PAYMENT_MULT) : 0,
    gems: c.gems ?? 0,
    em: c.em ? Math.round(c.em * emScale(s)) : 0,
    res: c.res ? scaledRes(s, c.res) : {},
  };
}

export function canPay(s: GameState, c: Cost | undefined, now: number): boolean {
  if (!c) return true;
  const k = choiceCost(s, c, now);
  return s.gems >= k.gems && s.fleet.em >= k.em && hasResources(s, k.res);
}

export function costText(s: GameState, c: Cost | undefined, now: number): string {
  if (!c) return '';
  const k = choiceCost(s, c, now);
  const parts: string[] = [];
  if (k.paySec) parts.push(`💸 ${fmtTime(k.paySec)} halbes Einkommen`);
  if (k.gems) parts.push(`${k.gems} 💎`);
  if (k.em) parts.push(`${fmt(k.em, false)} ⚗️`);
  for (const id in k.res) parts.push(`${fmt(k.res[id as ResId] ?? 0, false)} ${RES_META[id as ResId].emoji}`);
  return parts.join(' + ');
}

/** Erfolgschance einer riskanten Entscheidung (Talent „Spieler“ hilft), null = sicher */
export function choiceChance(s: GameState, ch: ChoiceDef): number | null {
  if (ch.chance === undefined) return null;
  return Math.min(0.95, ch.chance + talentBonus(s).riskBonus);
}

// ---- Ruf ------------------------------------------------------------------------

export function factionRep(s: GameState, f: FactionId): number {
  return s.factions[f] ?? 0;
}

export function factionLevel(s: GameState, f: FactionId): number {
  return repLevel(factionRep(s, f));
}

/** Ruf ändern (Gewinne mit Talent „Diplomat“ ×1,5); nie unter 0 */
export function addRep(s: GameState, f: FactionId, n: number): number {
  const before = factionLevel(s, f);
  const delta = n > 0 ? Math.round(n * talentBonus(s).repMult) : n;
  s.factions[f] = Math.max(0, factionRep(s, f) + delta);
  const after = factionLevel(s, f);
  if (after > before) emit('factionUp', { faction: f, level: after });
  return delta;
}

// ---- Folgen ---------------------------------------------------------------------

function rollMinRarity(min: Rarity, rnd: () => number): Rarity {
  const pool = RARITY_ORDER.slice(RARITY_ORDER.indexOf(min));
  const weights = [60, 30, 9, 1].slice(RARITY_ORDER.indexOf(min));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Ein Artefakt mindestens der Seltenheit `min` – gibt eine Beschreibung zurück */
export function giveArtifact(s: GameState, min: Rarity, rnd: () => number): string {
  const found = grantArtifact(s, randomArtifactOf(rollMinRarity(min, rnd), rnd));
  const def = ARTIFACT_INDEX[found.id];
  const extra = found.isNew ? 'neu!' : found.converted ? `→ ${found.converted} ⚗️` : `Stufe ${found.level}`;
  return `${def.emoji} ${def.name} (${RARITY[def.rarity].name}, ${extra})`;
}

export function giveDust(s: GameState, pct: number): number {
  const n = Math.max(1, Math.floor(cap(s.stardustEarned * pct)));
  s.stardust = cap(s.stardust + n);
  s.stardustEarned = cap(s.stardustEarned + n);
  s.stardustLifetime = cap(s.stardustLifetime + n);
  return n;
}

/** Wendet Folgen an und gibt lesbare Zeilen für die Anzeige zurück */
export function applyEffects(s: GameState, effects: Effect[], now: number, rnd: () => number = Math.random, source = 'ev'): string[] {
  const lines: string[] = [];
  const luck = talentBonus(s).randomLoot;
  for (const e of effects) {
    switch (e.t) {
      case 'cash': {
        const n = cap(incomeRate(s, now) * e.sec * luck);
        earn(s, n);
        lines.push(`+${fmt(n)} 🪙`);
        break;
      }
      case 'gems':
        lines.push(`+${addGems(s, e.n * luck)} 💎`);
        break;
      case 'em': {
        const n = Math.round(e.n * emScale(s) * (e.n > 0 ? luck : 1));
        if (n >= 0) addEm(s, n);
        else s.fleet.em = Math.max(0, s.fleet.em + n);
        lines.push(`${n >= 0 ? '+' : '−'}${fmt(Math.abs(n), false)} ⚗️`);
        break;
      }
      case 'res': {
        const r = scaledRes(s, e.r, luck);
        addResources(s, r);
        for (const id in r) lines.push(`+${fmt(r[id as ResId] ?? 0, false)} ${RES_META[id as ResId].emoji} ${RES_META[id as ResId].name}`);
        break;
      }
      case 'boost':
        addBoost(s, { id: `${source}_${e.kind}_${e.mult}`, kind: e.kind, mult: e.mult, label: e.mult >= 1 ? 'Funkspruch' : 'Störung', icon: e.mult >= 1 ? '📡' : '⚠️' }, e.min * 60, now, 7200);
        lines.push(`${e.kind === 'income' ? 'Einkommen' : 'Tempo'} ×${String(e.mult).replace('.', ',')} für ${e.min} min`);
        break;
      case 'dust':
        lines.push(`+${fmt(giveDust(s, e.pct * luck), false)} ✨`);
        break;
      case 'artifact':
        lines.push('🏺 ' + giveArtifact(s, e.min, rnd));
        break;
      case 'rep': {
        const f = FACTION_INDEX[e.f];
        const d = addRep(s, e.f, e.n);
        lines.push(`${f.emoji} ${f.name} ${d >= 0 ? '+' : ''}${d} Ruf`);
        break;
      }
      case 'xp': {
        // ein Viertel des angegebenen Level-Anteils: Funksprüche sind häufig, der Talentbaum soll Wochen tragen
        const n = Math.max(1, Math.round(xpForNext(s.rank.level) * e.frac * EVENT_XP_SCALE));
        addXp(s, n);
        lines.push(`+${fmt(n, false)} XP`);
        break;
      }
      case 'comets':
        emit('cometShower', { n: e.n });
        lines.push(`☄️ ${e.n} goldene Komet${e.n === 1 ? '' : 'en'}`);
        break;
      case 'chain':
        s.events.chains[e.id] = now + e.min * 60000;
        lines.push('📡 Fortsetzung folgt …');
        break;
    }
  }
  return lines;
}

export interface EventResult {
  ok: boolean;
  success: boolean;
  text: string;
  lines: string[];
}

/** Beantwortet den Funkspruch an Position `index` der Warteschlange mit Entscheidung `choice` */
export function answerEvent(s: GameState, index: number, choice: number, now: number, rnd: () => number = Math.random): EventResult {
  const q = s.events.queue[index];
  const ev = q && EVENT_INDEX[q.id];
  const ch = ev?.choices[choice];
  if (!ev || !ch) return { ok: false, success: false, text: 'Dieser Funkspruch ist nicht mehr da.', lines: [] };
  if (!canPay(s, ch.cost, now)) return { ok: false, success: false, text: 'Dafür reicht es gerade nicht.', lines: [] };
  if (ch.cost) {
    const k = choiceCost(s, ch.cost, now);
    if (k.paySec) addBoost(s, { id: 'payment', kind: 'income', mult: PAYMENT_MULT, label: 'Zahlung', icon: '💸' }, k.paySec, now, 24 * 3600);
    s.gems -= k.gems;
    s.fleet.em -= k.em;
    payResources(s, k.res);
  }
  const chance = choiceChance(s, ch);
  const success = chance === null || rnd() < chance;
  const outcome = success || !ch.lose ? ch.win : ch.lose;
  s.events.queue.splice(index, 1);
  s.events.seen[ev.id] = (s.events.seen[ev.id] ?? 0) + 1;
  s.stats.eventsAnswered++;
  const lines = applyEffects(s, outcome.effects, now, rnd, ev.id);
  addXp(s, 10);
  emit('structure', {});
  return { ok: true, success: chance === null || success, text: outcome.text, lines };
}

// ---- Fraktions-Shop ----------------------------------------------------------------

function offerKey(id: string, now: number): string {
  return `${weekKey(now)}:${id}`;
}

export function offerBought(s: GameState, id: string, now: number): boolean {
  return (s.factionBuys[offerKey(id, now)] ?? 0) > 0;
}

export function offerPrice(s: GameState, id: string): { gems: number; em: number } {
  const o = OFFERS.find((x) => x.id === id)!;
  return { gems: o.price.gems ?? 0, em: Math.round((o.price.em ?? 0) * emScale(s)) };
}

export function buyOffer(s: GameState, id: string, now: number, rnd: () => number = Math.random): { ok: boolean; lines: string[]; text: string } {
  const o = OFFERS.find((x) => x.id === id);
  if (!o) return { ok: false, lines: [], text: 'Unbekanntes Angebot' };
  if (factionLevel(s, o.faction) < o.level) return { ok: false, lines: [], text: `Benötigt Ruf-Stufe „${REP_NAMES[o.level]}“` };
  if (offerBought(s, id, now)) return { ok: false, lines: [], text: 'Diese Woche schon gekauft' };
  const p = offerPrice(s, id);
  if (s.gems < p.gems || s.fleet.em < p.em) return { ok: false, lines: [], text: 'Nicht genug Kristalle oder Materie' };
  s.gems -= p.gems;
  s.fleet.em -= p.em;
  let lines: string[] = [];
  switch (o.id) {
    case 'o_res': lines = applyEffects(s, [{ t: 'res', r: { metal: 4000, crystal: 2500, deut: 1200 } }], now, rnd); break;
    case 'o_gems': lines = [`+${addGems(s, 60, false)} 💎`]; break;
    case 'o_boost':
      addBoost(s, { id: 'o_boost', kind: 'income', mult: 3, label: 'Goldene Stunde', icon: '🔥' }, 3600, now);
      lines = ['Einkommen ×3 für 1 Stunde'];
      break;
    case 'o_chips': lines = applyEffects(s, [{ t: 'res', r: { chips: 600 } }], now, rnd); break;
    case 'o_xp': lines = applyEffects(s, [{ t: 'xp', frac: 0.5 }], now, rnd); break;
    case 'o_dust': lines = [`+${fmt(giveDust(s, 0.03), false)} ✨`]; break;
    case 'o_alloy': lines = applyEffects(s, [{ t: 'res', r: { alloy: 900 } }], now, rnd); break;
    case 'o_em': addEm(s, Math.round(300 * emScale(s))); lines = [`+${fmt(Math.round(300 * emScale(s)), false)} ⚗️`]; break;
    case 'o_crate': lines = ['🏺 ' + giveArtifact(s, 'rare', rnd)]; break;
    case 'o_warp': lines = [`+${fmt(timeWarp(s, 4, now, true))} 🪙 aus 4 Stunden`]; break;
    case 'o_epic': lines = ['🏺 ' + giveArtifact(s, 'epic', rnd)]; break;
    case 'o_legend': lines = ['🏺 ' + giveArtifact(s, 'legendary', rnd)]; break;
  }
  // nur die laufende Woche merken
  const week = weekKey(now) + ':';
  for (const k in s.factionBuys) if (!k.startsWith(week)) delete s.factionBuys[k];
  s.factionBuys[offerKey(id, now)] = 1;
  emit('structure', {});
  return { ok: true, lines, text: `${o.emoji} ${o.name}` };
}
