// Headless-Balancing: ein Bot spielt mit der echten Spiellogik und protokolliert die Zeitachse.
// Aufruf: npx tsx scripts/simulate.ts [Stunden]
import { BUILDINGS, BUILDING_COUNT } from '../src/data/buildings';
import { MANAGERS } from '../src/data/managers';
import { UPGRADES } from '../src/data/upgrades';
import { LAB_NODES } from '../src/data/lab';
import { PLANETS } from '../src/data/planets';
import { QUANTUM_PERKS } from '../src/data/quantum';
import { defaultState } from '../src/core/state';
import {
  buildingCost, compute, lab, milestoneCount, newCalc, pendingStardust, stardustExact, pendingQuantum, canGalaxyJump,
} from '../src/core/economy';
import { buyBuilding, buyLab, buyQuantum, buyShop, buyUpgrade, hireManager, labAvailable, permCost, tapBuilding } from '../src/core/actions';
import { tick, newTickOut } from '../src/core/tick';
import { supernova, galaxyJump } from '../src/core/prestige';
import { claimQuest } from '../src/core/meta';
import { fmt, fmtTime } from '../src/core/format';

declare const process: { argv: string[]; env: Record<string, string | undefined> };
const HOURS = Number(process.argv[2] ?? 48);
const DEBUG_S = Number(process.env.DEBUG_S ?? 0);
const s = defaultState(0);
s.settings.autoSupernova = true;
const calc = newCalc();
const out = newTickOut();

let t = 0; // Sekunden
const log = (msg: string) => console.log(`${fmtTime(t).padStart(12)}  ${msg}`);

const marks = new Set<string>();
function mark(key: string, msg: string) {
  if (marks.has(key)) return;
  marks.add(key);
  log(msg);
}

function upgMult(i: number): number {
  let m = 1;
  for (const u of UPGRADES) if (u.target === i && s.upgrades[u.id]) m *= u.mult;
  return m;
}

function incomeOf(owned: number, unit: number): number {
  return unit * owned * Math.pow(2, milestoneCount(owned));
}

function botBuy() {
  // Manager zuerst
  for (let i = 0; i < BUILDING_COUNT; i++) {
    if (!s.managers[i] && s.buildings[i].owned > 0 && MANAGERS[i].cost <= s.cash) {
      hireManager(s, i);
      mark('mgr' + i, `Manager ${i + 1} (${MANAGERS[i].name})`);
    }
  }
  for (const u of UPGRADES) {
    if (s.upgrades[u.id]) continue;
    if (u.cost > s.cash) break;
    buyUpgrade(s, u.id);
  }
  // Sparen, wenn das nächste Upgrade/Manager bald bezahlbar ist
  compute(s, 0, calc);
  const rate = Math.max(calc.potential, 1);
  const nextUpg = UPGRADES.find((u) => !s.upgrades[u.id]);
  const nextMgr = MANAGERS.find((_, i) => !s.managers[i] && s.buildings[i].owned > 0);
  let reserve = 0;
  if (nextUpg && nextUpg.cost < rate * 90) reserve = Math.max(reserve, nextUpg.cost);
  if (nextMgr && nextMgr.cost < rate * 90) reserve = Math.max(reserve, nextMgr.cost);

  const perm = calc.perm.total;
  const warp = 1 + 0.25 * lab(s, 'warp');
  for (let iter = 0; iter < 200; iter++) {
    let best = -1;
    let bestN = 0;
    let bestScore = 0;
    for (let i = 0; i < BUILDING_COUNT; i++) {
      if (s.buildings[i].owned === 0 && i > 0 && s.buildings[i - 1].owned === 0) continue;
      const d = BUILDINGS[i];
      const unit = (d.baseRevenue * upgMult(i) * perm * warp) / d.baseTime;
      const o = s.buildings[i].owned;
      const cur = incomeOf(o, unit);
      for (const n of [1, 10]) {
        const cost = buildingCost(s, i, n);
        if (cost > s.cash - reserve) continue;
        const score = (incomeOf(o + n, unit) - cur + (o === 0 ? unit * 5 : 0)) / cost;
        if (score > bestScore) {
          bestScore = score;
          best = i;
          bestN = n;
        }
      }
    }
    if (best < 0) break;
    buyBuilding(s, best, bestN as 1 | 10);
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
      let c = n.cost(lvl);
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
  for (let iter = 0; iter < 50; iter++) {
    let bought = false;
    for (const p of QUANTUM_PERKS) if (buyQuantum(s, p.id)) bought = true;
    if (!bought) break;
  }
}

let lastHist = -1;
let bestRate = 0;
const pHist: number[] = [];
const FIRST_GOAL = 10;
let lastReport = 0;
const end = HOURS * 3600;
while (t < end) {
  const dt = s.runTime < 120 ? 0.25 : 1;
  for (let i = 0; i < BUILDING_COUNT; i++) tapBuilding(s, i);
  tick(s, dt, 0, calc, out);
  t += dt;
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
  const ready = S === 0 ? p >= FIRST_GOAL : s.runTime > 120 && (p >= S || stalled);
  if (ready) {
    const planetBefore = s.planet;
    const run = s.runTime;
    supernova(s);
    log(`💥 Supernova #${s.totalSupernovas} nach ${fmtTime(run)}: +${fmt(p)} ✨ (gesamt ${fmt(s.stardustEarned)})` +
      (s.planet > planetBefore ? `  → 🪐 ${PLANETS[s.planet].name}` : ''));
    pHist.length = 0;
    bestRate = 0;
    botLab();
    if (DEBUG_S) log('   lab ' + JSON.stringify(s.lab));
  }
  if (canGalaxyJump(s) && pendingQuantum(s) >= Math.max(3, s.quantumEarned * 0.5)) {
    const q = pendingQuantum(s);
    galaxyJump(s);
    log(`⚛️  Galaxie-Sprung #${s.galaxyJumps}: +${q} Quantenkerne`);
    botQuantum();
    botLab();
  }
  if (t - lastReport >= 3600) {
    lastReport = t;
    compute(s, 0, calc);
    log(`   [Status] Geld ${fmt(s.cash)} · ${fmt(calc.income)}/s · ✨ ${fmt(s.stardustEarned)} · Planet ${PLANETS[s.planet].name} · 💎 ${s.gems} · Anl. ${s.buildings.map((b) => b.owned).join('/')}`);
  }
}
console.log('\nErfolge:', Object.keys(s.achievements).length, '· Supernovas:', s.totalSupernovas, '· Upgrades max:', s.stats.upgradesBought);
