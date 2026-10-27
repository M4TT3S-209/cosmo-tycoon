// Headless-Balancing: ein Bot spielt mit der echten Spiellogik und protokolliert die Zeitachse.
// Aufruf: npx tsx scripts/simulate.ts [Stunden]
import { BUILDING_COUNT } from '../src/data/buildings';
import { MANAGERS } from '../src/data/managers';
import { LAB_NODES } from '../src/data/lab';
import { PLANETS } from '../src/data/planets';
import { QUANTUM_PERKS } from '../src/data/quantum';
import { defaultState } from '../src/core/state';
import { compute, lab, labCost, newCalc, pendingStardust, stardustExact, pendingQuantum, canGalaxyJump } from '../src/core/economy';
import { buyLab, buyQuantum, buyShop, labAvailable, permCost, tapBuilding } from '../src/core/actions';
import { autoSpend } from '../src/core/autobuy';
import { tick, newTickOut } from '../src/core/tick';
import { supernova, galaxyJump } from '../src/core/prestige';
import { claimQuest } from '../src/core/meta';
import { fmt, fmtTime } from '../src/core/format';
import { EXPEDITIONS, SHIP_MODULES } from '../src/data/expeditions';
import { ARTIFACT_INDEX, RARITY_ORDER } from '../src/data/artifacts';
import { buyCrate, claimExpedition, destUnlocked, missionAt, moduleCost, startExpedition, upgradeModule } from '../src/core/fleet';
import { artifactSlots } from '../src/core/rank';
import { abortChallenge, challengeGoal, challengesUnlocked, startChallenge } from '../src/core/challenges';
import { simulateOffline } from '../src/core/offline';
import { CHALLENGES } from '../src/data/challenges';
import { MEGAPROJECTS } from '../src/data/megaprojects';
import { RES_IDS, prosperityMult, totalColonyLevels } from '../src/core/colonies';
import { talentPointsSpent } from '../src/core/commander';
import { megaStage } from '../src/core/talentfx';
import { botV3 } from './bot-v3';

declare const process: { argv: string[]; env: Record<string, string | undefined> };
const HOURS = Number(process.argv[2] ?? 48);
const DEBUG_S = Number(process.env.DEBUG_S ?? 0);
/** OFFLINE=1: nach je 16 h aktivem Spiel 8 h offline (Nacht) */
const OFFLINE = !!process.env.OFFLINE;
const CHAL_CHANCE = Number(process.env.CHAL ?? 0.35);
/** STYLE=nutzer: wie ein schneller Spieler – kleine Supernovas ab +5 % nach 2 min, Galaxie-Sprung erst spät */
const NUTZER = process.env.STYLE === 'nutzer';
const s = defaultState(0);
s.settings.autoSupernova = true;
const calc = newCalc();
const out = newTickOut();

let t = 0; // aktive Sekunden
let real = 0; // Wanduhr-Sekunden (inkl. Offline-Phasen)
const log = (msg: string) => console.log(`${fmtTime(OFFLINE ? real : t).padStart(12)}  ${msg}`);

const marks = new Set<string>();
function mark(key: string, msg: string) {
  if (marks.has(key)) return;
  marks.add(key);
  log(msg);
}

/** Der Bot kauft wie der Auto-Käufer im Spiel (vor dem Labor-Knoten spielt er ihn „von Hand“) */
function botBuy() {
  autoSpend(s, real * 1000, { buildings: true, upgrades: true });
  for (let i = 0; i < BUILDING_COUNT; i++) {
    if (s.managers[i]) mark('mgr' + i, `Manager ${i + 1} (${MANAGERS[i].name})`);
  }
}

function botLab() {
  for (let iter = 0; iter < 100; iter++) {
    let best: string | null = null;
    let bestCost = Infinity;
    for (const n of LAB_NODES) {
      if (!labAvailable(s, n.id)) continue;
      const lvl = lab(s, n.id);
      if (lvl >= n.maxLevel) continue;
      let c = labCost(s, n, lvl);
      if (n.id === 'income') c *= 0.5; // Einkommen bevorzugen
      if (['offtime', 'offeff', 'luck', 'gemfinder', 'magnet', 'boostlen'].includes(n.id)) c *= 4;
      if (c < bestCost) {
        bestCost = c;
        best = n.id;
      }
    }
    if (!best || !buyLab(s, best)) break;
  }
}

function botQuantum() {
  // Auto-Supernova zuerst (das macht jeder Spieler so)
  buyQuantum(s, 'qauto');
  for (let iter = 0; iter < 50; iter++) {
    let bought = false;
    for (const p of QUANTUM_PERKS) if (buyQuantum(s, p.id)) bought = true;
    if (!bought) break;
  }
}

function artScore(id: string): number {
  const d = ARTIFACT_INDEX[id];
  const lvl = s.artifacts[id]?.level ?? 0;
  const kind = d.kind === 'income' ? 100 : d.kind === 'dust' ? 80 : d.kind === 'bld' ? 30 + (d.b ?? 0) * 4 : d.kind === 'speed' ? 35 : 10;
  return kind + RARITY_ORDER.indexOf(d.rarity) * 8 + lvl * 2;
}

function botFleet(maxMinutes: number) {
  const nowMs = real * 1000;
  for (let i = 0; i < s.fleet.ships.length; i++) {
    const m = missionAt(s, i);
    if (m && m.end <= nowMs) claimExpedition(s, i, nowMs);
    if (!missionAt(s, i)) {
      const opts = EXPEDITIONS.filter((d) => destUnlocked(s, d) && d.minutes <= maxMinutes);
      const d = opts[opts.length - 1];
      if (d) startExpedition(s, i, d.id, nowMs);
    }
  }
  for (let k = 0; k < 60; k++) {
    let best: [number, 'engine' | 'cargo' | 'shield'] | null = null;
    let bc = Infinity;
    s.fleet.ships.forEach((ship, i) => {
      for (const mod of SHIP_MODULES) {
        if (ship[mod.id] >= 25) continue;
        const c = moduleCost(ship[mod.id], mod.id, s);
        if (c < bc) {
          bc = c;
          best = [i, mod.id];
        }
      }
    });
    if (!best || bc > s.fleet.em) break;
    upgradeModule(s, best[0], best[1]);
  }
  if (s.fleet.em > 4000) buyCrate(s);
  s.equipped = Object.keys(s.artifacts).sort((a, b) => artScore(b) - artScore(a)).slice(0, artifactSlots(s));
}

let chalStart = 0;
let chalDoneSeen = 0;
let seenNovas = 0;
let seenPlanet = 0;
let lastRankLog = 1;
let seenMega = 0;
let nextNight = 16 * 3600;

let lastHist = -1;
let bestRate = 0;
const pHist: number[] = [];
const FIRST_GOAL = 10;
let lastReport = 0;
const end = HOURS * 3600;
while (t < end) {
  const dt = s.runTime < 120 ? 0.25 : 1;
  for (let i = 0; i < BUILDING_COUNT; i++) tapBuilding(s, i);
  tick(s, dt, real * 1000, calc, out);
  t += dt;
  real += dt;
  if (Math.floor(t) % 60 === 0 && t % 1 < dt) botFleet(240);
  if (Math.floor(t) % 30 === 0 && t % 1 < dt) botV3(s, real * 1000, mark);
  if (s.stats.megaStages !== seenMega) {
    seenMega = s.stats.megaStages;
    log(`🏗️  Megaprojekt-Stufe fertig: ${MEGAPROJECTS.filter((m) => megaStage(s, m.id) > 0).map((m) => `${m.emoji}${megaStage(s, m.id)}`).join(' ')}`);
  }
  if (OFFLINE && t >= nextNight) {
    nextNight += 16 * 3600;
    botFleet(480);
    const r = simulateOffline(s, 8 * 3600, real * 1000);
    real += 8 * 3600;
    log(`🌙 Nacht offline (${fmtTime(r.counted)} gezählt): +${fmt(r.earned)} · ${r.bought} Anlagen · ${r.upgrades} Upgrades · ${r.managers} Manager` +
      (r.supernovas ? ` · 💥 ${r.supernovas} Supernovas +${fmt(r.stardust)} ✨` : '') + ` · ✨ möglich ${fmt(r.pendingBefore)} → ${fmt(r.pendingAfter)}` +
      (r.planetAfter > r.planetBefore ? `  → 🪐 ${PLANETS[r.planetAfter].name}` : ''));
    botFleet(240);
    botV3(s, real * 1000, mark);
  }
  // Supernovas, die das Spiel selbst ausgelöst hat (Auto-Supernova, auch offline): Sternenstaub investieren
  if (s.totalSupernovas !== seenNovas) {
    seenNovas = s.totalSupernovas;
    if (s.planet !== seenPlanet) log(`♻️  Auto-Supernova #${s.totalSupernovas} (gesamt ${fmt(s.stardustEarned)} ✨)  → 🪐 ${PLANETS[s.planet].name}`);
    seenPlanet = s.planet;
    pHist.length = 0;
    botLab();
  }
  if (s.rank.level >= lastRankLog + 10) {
    lastRankLog = Math.floor(s.rank.level / 10) * 10;
    log(`⭐ Rang ${s.rank.level} · ${Object.keys(s.artifacts).length} Artefakte · ⚗️ ${fmt(s.fleet.em)} · Schiffe ${s.fleet.ships.length}`);
  }
  if (s.challenge.active) {
    const id = s.challenge.active;
    if (t - chalStart > 45 * 60) {
      log(`🏅 Prüfung ${id} Stufe ${(s.challengeTiers[id] ?? 0) + 1} nicht geschafft (Ziel ${fmt(s.challenge.goal)}, erreicht ${fmt(s.runEarnings)})`);
      abortChallenge(s);
      botLab();
    }
  }
  if (Math.floor(t) % 2 === 0) botBuy();
  for (const q of s.quests) if (q.done) claimQuest(s, q.id);
  if (s.gems >= permCost(s)) {
    buyShop(s, 'perm', 0);
    log(`💎 Ewiger Verdoppler #${s.gemPerm}`);
  }

  if (DEBUG_S && s.stardustEarned >= DEBUG_S && s.runTime <= 200 && s.runTime % 10 < dt) {
    compute(s, 0, calc);
    const pm = calc.perm;
    log(`   dbg run ${Math.floor(s.runTime)}s cash ${fmt(s.cash)} inc ${fmt(calc.income)} perm ${fmt(pm.total)} [lab ${fmt(pm.lab)} sd ${fmt(pm.stardust)} pl ${pm.planet} emp ${fmt(pm.empire)} upAll ${fmt(pm.upgradesAll)}] upg ${Object.keys(s.upgrades).length} own ${s.buildings.map((b) => b.owned).join('/')} p ${pendingStardust(s)}`);
  }
  if (s.cash >= 1e6) mark('1e6', 'Erste Million');
  if (s.cash >= 1e9) mark('1e9', 'Erste Milliarde');

  // Supernova-Heuristik: verdoppeln oder bei Stillstand
  const p = pendingStardust(s);
  const S = s.stardustEarned;
  if (Math.floor(t) % 300 === 0 && Math.floor(t) !== lastHist) {
    lastHist = Math.floor(t);
    pHist.push(stardustExact(s));
    if (s.totalSupernovas === 0 && s.runTime < 3700 && s.runTime % 900 < 1) log(`   Lauf-Einnahmen ${fmt(s.runEarnings)} → ${p} ✨`);
  }
  const r = stardustExact(s) / Math.max(1, s.runTime);
  if (r > bestRate) bestRate = r;
  const p5 = pHist.length >= 2 ? pHist[pHist.length - 2] : 0;
  const stalled = s.runTime > 1200 && stardustExact(s) < p5 * 1.03 && p >= 0.2 * S;
  const ready = !s.challenge.active && (S === 0 ? p >= FIRST_GOAL : s.runTime > 120 && (p >= S || stalled || (NUTZER && p >= 0.05 * S)));
  if (ready) {
    const planetBefore = s.planet;
    const run = s.runTime;
    supernova(s);
    log(`💥 Supernova #${s.totalSupernovas} nach ${fmtTime(run)}: +${fmt(p)} ✨ (gesamt ${fmt(s.stardustEarned)})` +
      (s.planet > planetBefore ? `  → 🪐 ${PLANETS[s.planet].name}` : ''));
    pHist.length = 0;
    bestRate = 0;
    seenNovas = s.totalSupernovas;
    seenPlanet = s.planet;
    botLab();
    if (DEBUG_S) log('   lab ' + JSON.stringify(s.lab));
    if (challengesUnlocked(s) && Math.random() < CHAL_CHANCE) {
      const open = CHALLENGES.filter((c) => challengeGoal(s, c.id) !== null).sort((a, b) => (s.challengeTiers[a.id] ?? 0) - (s.challengeTiers[b.id] ?? 0));
      const c = open[Math.floor(Math.random() * Math.min(3, open.length))];
      if (c && startChallenge(s, c.id)) chalStart = t;
    }
  }
  if (!s.challenge.active && chalStart && s.stats.challengesDone > chalDoneSeen) {
    chalDoneSeen = s.stats.challengesDone;
    log(`🏅 Prüfung geschafft (${s.stats.challengesDone} gesamt) · Stufen ${JSON.stringify(s.challengeTiers)}`);
    chalStart = 0;
  }
  if (canGalaxyJump(s) && pendingQuantum(s) >= Math.max(3, s.quantumEarned * (NUTZER ? 1.5 : 0.5))) {
    const q = pendingQuantum(s);
    galaxyJump(s);
    log(`⚛️  Galaxie-Sprung #${s.galaxyJumps}: +${q} Quantenkerne`);
    seenPlanet = s.planet;
    botQuantum();
    botLab();
  }
  if (t - lastReport >= 3600) {
    lastReport = t;
    compute(s, 0, calc);
    log(`   [Status] Geld ${fmt(s.cash)} · ${fmt(calc.income)}/s · ✨ ${fmt(s.stardustEarned)} · Planet ${PLANETS[s.planet].name} · 💎 ${s.gems} · Rang ${s.rank.level} · Art ${Object.keys(s.artifacts).length} · ⚗️ ${fmt(s.fleet.em)}`);
    if (Object.keys(s.colonies).length) {
      log(`   [Kolonien] ${Object.keys(s.colonies).length} Kolonien · ${totalColonyLevels(s)} Stufen (Wohlstand ×${prosperityMult(s).toFixed(2)}) · ${RES_IDS.map((k) => `${k} ${fmt(s.res[k])}`).join(' · ')} · Talente ${talentPointsSpent(s)} · Funksprüche ${s.stats.eventsAnswered} · Ruf ${JSON.stringify(s.factions)}`);
    }
  }
}
console.log('');
console.log('Version 3:', 'Kolonie-Stufen', totalColonyLevels(s), '· Megaprojekte', JSON.stringify(s.mega.stages), '· Talente', talentPointsSpent(s), '· Funksprüche', s.stats.eventsAnswered, '· Ruf', JSON.stringify(s.factions), '· Wochen-Aufträge', s.stats.weeklyDone, '· Fähigkeiten', s.stats.abilitiesUsed);
console.log('\nErfolge:', Object.keys(s.achievements).length, '· Supernovas:', s.totalSupernovas, '· Rang:', s.rank.level, '· Artefakte:', JSON.stringify(Object.fromEntries(Object.entries(s.artifacts).map(([k, v]) => [k, v.level]))), '· Prüfungen:', JSON.stringify(s.challengeTiers), '· Expeditionen:', s.fleet.expeditions);
if (process.env.DUMP) console.log('JSON:' + JSON.stringify(s));
