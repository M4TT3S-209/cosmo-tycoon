import { ACHIEVEMENTS } from '../../data/achievements';
import { DAILY } from '../../data/daily';
import { SHOP, buyShop } from '../../core/actions';
import { ACHIEVEMENT_BONUS, RANK_BONUS, permanentMults } from '../../core/economy';
import { RANK_MAX, artifactSlots, hangarSlots, nextUnlock, rankTitle, xpForNext } from '../../core/rank';
import { fmt, fmtInt, fmtMult, fmtTime, setNotation } from '../../core/format';
import {
  COLLECTOR_COST, buyCollector, canClaimDaily, claimDaily, claimQuest, collectorActive, collectorAvailable, nextDailyDay, questProgress, questText,
} from '../../core/meta';
import { exportCode, hasPreUpdateBackup, importCode, loadPreUpdateBackup, saveGame, wipeSave } from '../../core/save';
import { defaultState } from '../../core/state';
import { megaStage } from '../../core/talentfx';
import { claimWeekly, weekEndsIn, weeklyClaimable, weeklyContract, weeklyMod, weeklyProgress, weeklyRewardEm } from '../../core/weekly';
import { WEEKLY_REWARD } from '../../data/weekly';
import { G, isIOS, isStandalone } from '../ctx';
import { h, setClass, setScale, setText, clear } from '../dom';
import { burstAt, toast } from '../fx';
import { showModal } from '../modal';
import { sfx, haptic, setMusic, setSound, setHaptics, setIgnoreMute, unlockAudio } from '../../audio/sfx';
import type { Screen } from './types';

const SUBS = [
  { id: 'missionen', label: '🎯 Ziele' },
  { id: 'shop', label: '💎 Shop' },
  { id: 'erfolge', label: '🏆 Erfolge' },
  { id: 'stats', label: '📊 Stats' },
  { id: 'optionen', label: '⚙️' },
];

export const APP_VERSION = '3.1.0';

let onReplaceState: (() => void) | null = null;
/** wird von app.ts gesetzt: nach Import/Reset alles neu starten */
export function setReplaceHandler(fn: () => void): void {
  onReplaceState = fn;
}

export function createMehr(): Screen {
  const el = h('div', { class: 'screen' });
  let updaters: (() => void)[] = [];
  const subBadges: Record<string, HTMLElement> = {};

  function build(): void {
    clear(el);
    updaters = [];
    const seg = h('div', { class: 'seg' });
    for (const sub of SUBS) {
      const badge = h('span', { class: 'badge dot' });
      subBadges[sub.id] = badge;
      const b = h('button', null, sub.label, badge);
      setClass(b, 'on', G.sub.mehr === sub.id);
      b.addEventListener('click', () => {
        G.sub.mehr = sub.id;
        sfx.click();
        haptic();
        build();
      });
      seg.appendChild(b);
    }
    el.appendChild(h('div', { class: 'sticky' }, seg));
    updaters.push(() => {
      const s = G.s;
      setClass(subBadges.missionen, 'on', s.quests.some((q) => q.done) || canClaimDaily(s, G.now) || weeklyClaimable(s));
    });
    switch (G.sub.mehr) {
      case 'shop': buildShop(); break;
      case 'erfolge': buildAchievements(); break;
      case 'stats': buildStats(); break;
      case 'optionen': buildOptions(); break;
      default: buildQuests();
    }
  }

  // ---- Missionen + tägliche Belohnung ----------------------------------------
  function buildRank(): void {
    const s = G.s;
    const fill = h('i');
    const xpText = h('div', { class: 'sub num' }, '');
    const lvl = h('span', { class: 'num' }, '');
    el.appendChild(h('div', { class: 'card glow rank-card', style: '--c:#fbbf24' },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round', style: '--c:#fbbf24' }, '⭐'),
        h('div', { class: 'col' },
          h('div', { class: 'title' }, `${rankTitle(s.rank.level)} · Level `, lvl),
          h('div', { class: 'progress', style: 'margin-top:4px' }, fill),
          xpText,
        ),
      ),
      h('div', { class: 'sub', style: 'margin-top:8px' },
        `+${Math.round(RANK_BONUS * 100)} % Einkommen pro Level · Hangar ${hangarSlots(s)} · Artefakt-Plätze ${artifactSlots(s)}`,
        h('br'),
        nextUnlock(s) ?? 'Alle Freischaltungen erreicht!',
      ),
      h('div', { class: 'hint', style: 'margin-top:6px' }, 'XP gibt es für Meilensteine, Upgrades, Manager, Kometen, Missionen, Erfolge, Supernovas, Expeditionen und Prüfungen.'),
    ));
    updaters.push(() => {
      const r = G.s.rank;
      setText(lvl, String(r.level));
      const need = xpForNext(r.level);
      setScale(fill, r.level >= RANK_MAX ? 1 : r.xp / need);
      setText(xpText, r.level >= RANK_MAX ? 'Maximaler Rang!' : `${fmt(r.xp, false)} / ${fmt(need, false)} XP bis Level ${r.level + 1}`);
    });
  }

  function buildWeekly(): void {
    const s = G.s;
    const mod = weeklyMod(s);
    const c = weeklyContract(s);
    if (!mod || !c) return;
    const fill = h('i');
    const ptxt = h('span', { class: 'num' }, '');
    const left = h('span', { class: 'num' }, '');
    const btn = h('button', { class: 'btn block green', style: 'margin-top:10px' }, '');
    btn.addEventListener('click', () => {
      const lines = claimWeekly(G.s);
      if (lines) {
        sfx.claim();
        haptic();
        burstAt(btn, '#38bdf8', 32, 'spark', 1.2);
        toast('📅', 'Sonderauftrag erfüllt!', lines.join(' · '), true, 5000);
      } else sfx.error();
    });
    const week = s.weekly.key.split('-W')[1] ?? '';
    el.appendChild(h('div', { class: 'card glow weekly-card', style: '--c:#38bdf8' },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round', style: '--c:#38bdf8' }, mod.emoji),
        h('div', { class: 'col' },
          h('div', { class: 'title' }, `Woche ${Number(week) || ''}: ${mod.name}`),
          h('div', { class: 'sub' }, mod.desc),
          h('div', { class: 'hint' }, '⏳ Neue Woche in ', left),
        ),
      ),
      h('div', { class: 'section-title', style: 'margin:10px 0 4px' }, 'Sonderauftrag'),
      h('div', { class: 'row' },
        h('span', { style: 'font-size:22px' }, c.emoji),
        h('div', { class: 'col' },
          h('div', { style: 'font-weight:800' }, c.text),
          h('div', { class: 'progress' }, fill),
          h('div', { class: 'sub' }, ptxt, ` · Belohnung: ${WEEKLY_REWARD.gems} 💎, ${fmt(weeklyRewardEm(s), false)} ⚗️ und ein Artefakt`),
        ),
      ),
      btn,
    ));
    updaters.push(() => {
      const st = G.s;
      const p = weeklyProgress(st);
      setScale(fill, p / c.goal);
      setText(ptxt, `${p}/${c.goal}`);
      setText(left, fmtTime(weekEndsIn(G.now) / 1000));
      const ready = weeklyClaimable(st);
      setClass(btn, 'off', !ready);
      setText(btn, st.weekly.claimed ? '✅ Abgeholt – nächste Woche gibt es einen neuen Auftrag' : ready ? '🎁 Belohnung abholen' : `Noch ${c.goal - p} bis zur Belohnung`);
      if (st.weekly.contract !== c.id) G.dirty = true;
    });
  }

  function buildQuests(): void {
    buildRank();
    buildWeekly();
    const s = G.s;
    const today = canClaimDaily(s, G.now);
    const day = nextDailyDay(s, G.now);
    const grid = h('div', { class: 'daily-grid' });
    DAILY.forEach((r, i) => {
      const d = i + 1;
      const done = today ? d < day : d <= day;
      const isToday = today && d === day;
      grid.appendChild(h('div', { class: 'daily-day' + (done ? ' done' : '') + (isToday ? ' today' : '') }, `Tag ${d}`, h('span', { class: 'e' }, done ? '✅' : r.emoji)));
    });
    const reward = DAILY[day - 1];
    const claimBtn = h('button', { class: 'btn block' + (today ? '' : ' off'), style: 'white-space:normal;height:auto;min-height:44px;padding:8px 12px' }, today ? `🎁 Tag ${day} abholen: ${reward.label}` : '✅ Heute schon abgeholt – komm morgen wieder!');
    claimBtn.addEventListener('click', () => {
      if (!canClaimDaily(G.s, Date.now())) return;
      const r = claimDaily(G.s, Date.now());
      if (r) {
        sfx.claim();
        haptic();
        burstAt(claimBtn, '#ffd166', 30, 'coin', 1.2);
        toast(r.emoji, 'Tägliche Belohnung', r.label, true);
      }
    });
    el.appendChild(h('div', { class: 'card glow', style: '--c:#ffd166' },
      h('div', { class: 'title' }, '📅 Tägliche Belohnung'),
      h('div', { class: 'sub' }, `Serie: ${s.daily.streak} Tag${s.daily.streak === 1 ? '' : 'e'} – verpasst du einen Tag, beginnt sie von vorn.`),
      grid,
      claimBtn,
    ));
    // neuer Tag, während das Menü offen ist → neu aufbauen
    updaters.push(() => {
      if (canClaimDaily(G.s, G.now) !== today) G.dirty = true;
    });

    el.appendChild(h('div', { class: 'section-title' }, 'Missionen'));
    if (collectorActive(s)) el.appendChild(h('div', { class: 'hint', style: 'margin:0 4px' }, '🤖 Der Kristall-Sammler holt fertige Missionen automatisch ab.'));
    for (const q of s.quests) {
      const wasDone = q.done;
      const fill = h('i');
      const ptxt = h('span', { class: 'num' }, '');
      let right: HTMLElement;
      if (q.done) {
        right = h('button', { class: 'btn small green' }, `+${q.reward} 💎`);
        right.addEventListener('click', () => {
          const n = claimQuest(G.s, q.id);
          if (n) {
            sfx.gems();
            haptic();
            burstAt(right, '#67e8f9', 24, 'spark', 1);
            toast('💎', `+${n} Kristalle`, 'Mission erfüllt!');
          }
        });
      } else right = h('span', { class: 'tag' }, `${q.reward} 💎`);
      el.appendChild(h('div', { class: 'card' + (q.done ? ' glow' : ''), style: '--c:#34d399' },
        h('div', { class: 'row' },
          h('div', { class: 'col' },
            h('div', { class: 'title', style: 'white-space:normal' }, questText(q)),
            h('div', { class: 'progress', style: 'margin-top:4px' }, fill),
            h('div', { class: 'sub' }, ptxt),
          ),
          right,
        ),
      ));
      updaters.push(() => {
        // Mission fertig geworden oder ersetzt → Karte mit Abholen-Knopf neu aufbauen
        if (q.done !== wasDone || !G.s.quests.includes(q)) {
          G.dirty = true;
          return;
        }
        const [cur, goal] = questProgress(G.s, q);
        setScale(fill, cur / goal);
        setText(ptxt, `${fmt(Math.min(cur, goal), false)} / ${fmt(goal, false)}`);
      });
    }
    el.appendChild(h('div', { class: 'hint', style: 'text-align:center;margin-top:4px' }, 'Neue Missionen erscheinen, sobald du eine abholst.'));
  }

  // ---- Shop ------------------------------------------------------------------
  function buildShop(): void {
    const gems = h('span', { class: 'num gem-c' }, '');
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round', style: '--c:#22d3ee' }, '💎'),
        h('div', { class: 'col' },
          h('div', { class: 'title' }, 'Kristall-Shop'),
          h('div', { class: 'sub' }, 'Kristalle verdienst du mit Missionen, Erfolgen, Kometen und der täglichen Belohnung.'),
        ),
        h('div', { class: 'big-num', style: 'font-size:20px' }, gems),
      ),
    ));
    updaters.push(() => setText(gems, fmt(G.s.gems, false)));
    if (collectorAvailable(G.s)) buildCollectorCard();
    for (const item of SHOP) {
      const costEl = h('span', { class: 'num' }, '');
      const btn = h('button', { class: 'btn small cyan' }, costEl, ' 💎');
      btn.addEventListener('click', () => {
        if (buyShop(G.s, item.id, Date.now())) {
          sfx.claim();
          haptic();
          burstAt(btn, '#67e8f9', 24, 'spark', 1.1);
          toast(item.emoji, item.name, 'Aktiviert!');
          if (item.id === 'perm') G.dirty = true;
        } else sfx.error();
      });
      const extra = h('div', { class: 'sub num' }, '');
      el.appendChild(h('div', { class: 'card' + (item.id === 'perm' ? ' glow' : ''), style: '--c:#67e8f9' },
        h('div', { class: 'row' },
          h('div', { class: 'icon-round' }, item.emoji),
          h('div', { class: 'col' }, h('div', { class: 'title' }, item.name), h('div', { class: 'sub' }, item.desc), extra),
          btn,
        ),
      ));
      updaters.push(() => {
        const c = item.cost(G.s);
        setText(costEl, fmt(c, false));
        setClass(btn, 'off', c > G.s.gems);
        if (item.id === 'perm') setText(extra, `Bisher gekauft: ${G.s.gemPerm}× (${fmtMult(Math.pow(2, G.s.gemPerm))})`);
        if (item.id.startsWith('warp')) {
          const hours = item.id === 'warp1' ? 1 : item.id === 'warp8' ? 8 : 24;
          const rate = Math.max(G.calc.baseIncome, 0);
          setText(extra, rate > 0 ? `≈ +${fmt(rate * hours * 3600)} 🪙` : 'Stelle Manager ein, um mehr zu bekommen');
        }
      });
    }
  }

  function buildCollectorCard(): void {
    const s = G.s;
    let right: HTMLElement;
    if (s.gemCollector) right = h('span', { class: 'owned-tag' }, s.settings.autoCollect ? '✓ Aktiv' : 'Aus');
    else {
      const btn = h('button', { class: 'btn small cyan' }, `${fmt(COLLECTOR_COST, false)} 💎`);
      btn.addEventListener('click', () => {
        if (buyCollector(G.s)) {
          sfx.claim();
          haptic();
          burstAt(btn, '#67e8f9', 30, 'spark', 1.2);
          toast('🤖', 'Kristall-Sammler aktiv', 'Fertige Missionen werden ab jetzt automatisch abgeholt.', true, 4000);
        } else {
          sfx.error();
          toast('💎', 'Nicht genug Kristalle', `Du brauchst ${fmt(COLLECTOR_COST, false)} 💎.`);
        }
      });
      updaters.push(() => setClass(btn, 'off', G.s.gems < COLLECTOR_COST));
      right = btn;
    }
    el.appendChild(h('div', { class: 'card glow', style: '--c:#67e8f9' },
      h('div', { class: 'row' },
        h('div', { class: 'icon-round' }, '🤖'),
        h('div', { class: 'col' },
          h('div', { class: 'title' }, 'Kristall-Sammler'),
          h('div', { class: 'sub' }, 'Holt fertige Missionen automatisch ab – du musst nicht mehr tippen. Einmal kaufen, gilt für immer.'),
          s.gemCollector ? h('div', { class: 'hint' }, 'An/aus unter Mehr → ⚙️') : null,
        ),
        right,
      ),
    ));
  }

  // ---- Erfolge -----------------------------------------------------------------
  function buildAchievements(): void {
    const s = G.s;
    const done = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'title' }, `🏆 Erfolge: ${done}/${ACHIEVEMENTS.length}`),
      h('div', { class: 'sub' }, `Jeder Erfolg gibt Kristalle und dauerhaft +${Math.round(ACHIEVEMENT_BONUS * 100)} % Einkommen. Aktuell: +${done} %.`),
      h('div', { class: 'progress', style: 'margin-top:8px' }, h('i', { style: `transform:scaleX(${done / ACHIEVEMENTS.length})` })),
    ));
    const grid = h('div', { class: 'ach-grid' });
    const sorted = [...ACHIEVEMENTS].sort((a, b) => {
      const da = s.achievements[a.id] ? 1 : 0;
      const db = s.achievements[b.id] ? 1 : 0;
      if (da !== db) return da - db;
      const [ca, ga] = a.progress(s);
      const [cb, gb] = b.progress(s);
      return cb / gb - ca / ga;
    });
    for (const a of sorted) {
      const isDone = !!s.achievements[a.id];
      const [cur, goal] = a.progress(s);
      grid.appendChild(h('div', { class: 'card ach' + (isDone ? ' done' : '') },
        h('div', { class: 'row', style: 'gap:6px' }, h('span', { class: 'e' }, a.emoji), h('span', { class: 'tag', style: 'margin-left:auto' }, isDone ? '✓' : `${a.gems} 💎`)),
        h('div', { class: 'n' }, a.name),
        h('div', { class: 'd' }, a.desc),
        isDone ? null : h('div', { class: 'progress' }, h('i', { style: `transform:scaleX(${Math.min(1, cur / goal)})` })),
      ));
    }
    el.appendChild(grid);
  }

  // ---- Statistik ---------------------------------------------------------------
  function buildStats(): void {
    const s = G.s;
    const kv = h('div', { class: 'kv' });
    const live: [HTMLElement, () => string][] = [];
    const add = (k: string, v: string | (() => string)) => {
      const vEl = h('span', { class: 'num' }, typeof v === 'string' ? v : v());
      kv.append(h('span', null, k), vEl);
      if (typeof v === 'function') live.push([vEl, v]);
    };
    add('Spielzeit', () => fmtTime(G.s.stats.playTime));
    add('Insgesamt verdient', () => fmt(G.s.totalEarnings));
    add('Dieser Lauf', () => fmt(G.s.runEarnings));
    add('Laufzeit', () => fmtTime(G.s.runTime));
    add('Bestes Einkommen', () => fmt(G.s.stats.bestIncome) + '/s');
    add('Anlagen gekauft', () => fmtInt(G.s.stats.buildingsBought));
    add('Upgrades gekauft', () => fmtInt(G.s.stats.upgradesBought));
    add('Manager eingestellt', () => fmtInt(G.s.stats.managersHired));
    add('Tipps', () => fmtInt(G.s.stats.taps));
    add('Kometen gefangen', () => fmtInt(G.s.stats.cometsTapped));
    add('Missionen erfüllt', () => fmtInt(G.s.stats.questsDone));
    add('Supernovas', String(s.totalSupernovas));
    add('Schnellste Supernova', s.stats.fastestSupernova ? fmtTime(s.stats.fastestSupernova) : '–');
    add('Galaxie-Sprünge', String(s.galaxyJumps));
    add('Kommandanten-Level', String(s.rank.level));
    add('Expeditionen', () => fmtInt(G.s.fleet.expeditions));
    add('Exotische Materie gesammelt', () => fmt(G.s.fleet.emEarned, false));
    add('Artefakte gefunden', String(Object.keys(s.artifacts).length));
    add('Prüfungs-Stufen', String(s.stats.challengesDone));
    add('Kristalle verdient', () => fmtInt(G.s.stats.gemsEarned));
    add('Spieltage', String(s.stats.daysPlayed));
    el.appendChild(h('div', { class: 'card' }, h('div', { class: 'title', style: 'margin-bottom:8px' }, '📊 Statistik'), kv));
    updaters.push(() => {
      for (const [e, f] of live) setText(e, f());
    });

    const pm = permanentMults(s);
    const mk = h('div', { class: 'kv' });
    const row = (k: string, v: number) => mk.append(h('span', null, k), h('span', { class: 'num' }, fmtMult(v)));
    row('🧪 Labor', pm.lab);
    row('✨ Sternenstaub', pm.stardust);
    row('🪐 Planet', pm.planet);
    row('⚛️ Quanten', pm.quantum);
    row('♾️ Ewige Verdoppler', pm.gems);
    row('🏆 Erfolge', pm.achievements);
    row('🏛️ Imperium-Meilensteine', pm.empire);
    row('🌐 Imperium-Protokolle', pm.upgradesAll);
    row('⭐ Kommandanten-Rang', pm.rank);
    row('🏺 Artefakte', pm.artifacts);
    row('🏅 Prüfungen', pm.challenges);
    row('👤 Talente', pm.talents);
    row('🪐 Kolonien & Dyson', pm.colonies);
    mk.append(h('span', { style: 'color:var(--text);font-weight:800' }, 'Gesamt'), h('span', { class: 'num gold-c' }, fmtMult(pm.total)));
    el.appendChild(h('div', { class: 'card' }, h('div', { class: 'title', style: 'margin-bottom:8px' }, '✖️ Multiplikatoren'), mk));
  }

  // ---- Einstellungen -------------------------------------------------------------
  function buildOptions(): void {
    const s = G.s;
    const box = h('div', { class: 'card' });
    const toggle = (label: string, sub: string, get: () => boolean, set: (v: boolean) => void, show = true) => {
      if (!show) return;
      const t = h('button', { class: 'toggle' + (get() ? ' on' : ''), 'aria-label': label });
      t.addEventListener('click', () => {
        set(!get());
        setClass(t, 'on', get());
        sfx.click();
        haptic();
      });
      box.appendChild(h('div', { class: 'setting' }, h('div', { class: 'label' }, label, h('small', null, sub)), t));
    };
    toggle('Soundeffekte', 'Klicks, Münzen, Explosionen', () => G.s.settings.sound, (v) => { G.s.settings.sound = v; setSound(v); });
    toggle('Musik', 'Ruhige Weltraum-Klänge', () => G.s.settings.music, (v) => { G.s.settings.music = v; unlockAudio(); setMusic(v); });
    toggle('Ton im Lautlos-Modus', 'Sounds auch bei eingeschaltetem Lautlos-Schalter am iPhone (pausiert dann andere Musik)', () => G.s.settings.ignoreMute, (v) => {
      G.s.settings.ignoreMute = v;
      setIgnoreMute(v);
      unlockAudio();
      if (G.s.settings.sound) setTimeout(() => sfx.claim(), 120);
    });
    toggle('Vibration', 'Haptisches Feedback (iOS 18+)', () => G.s.settings.haptics, (v) => { G.s.settings.haptics = v; setHaptics(v); });
    toggle('Wissenschaftliche Zahlen', 'z. B. 1,23e15 statt 1,23 Brd', () => G.s.settings.notation === 'sci', (v) => {
      G.s.settings.notation = v ? 'sci' : 'short';
      setNotation(G.s.settings.notation);
    });
    toggle('Auto-Käufer', 'Kauft Anlagen nach Kosten und Nutzen, achtet auf Meilensteine – auch offline', () => G.s.settings.autoBuy, (v) => { G.s.settings.autoBuy = v; }, (s.lab.autobuy ?? 0) > 0);
    toggle('Auto-Upgrader', 'Kauft Upgrades & Manager – auch offline', () => G.s.settings.autoUpgrade, (v) => { G.s.settings.autoUpgrade = v; }, (s.lab.autoupgrade ?? 0) > 0);
    toggle('Auto-Labor', 'Kauft Forschung im Labor automatisch, günstigste zuerst – auch offline (Quantenrechner Stufe 3)', () => G.s.settings.autoLab, (v) => { G.s.settings.autoLab = v; }, megaStage(s, 'rechner') >= 3);
    toggle('Kristall-Sammler', 'Holt fertige Missionen automatisch ab', () => G.s.settings.autoCollect, (v) => { G.s.settings.autoCollect = v; }, s.gemCollector);
    toggle('Auto-Supernova', 'Löst aus, wenn sich der Sternenstaub verdoppelt oder der Lauf kaum noch wächst – auch offline', () => G.s.settings.autoSupernova, (v) => { G.s.settings.autoSupernova = v; }, (s.qperks.qauto ?? 0) > 0);
    el.appendChild(box);

    // Spielstand
    const exp = h('button', { class: 'btn small ghost' }, '📤 Exportieren');
    exp.addEventListener('click', () => exportDialog());
    const imp = h('button', { class: 'btn small ghost' }, '📥 Importieren');
    imp.addEventListener('click', () => importDialog());
    const save = h('button', { class: 'btn small ghost' }, '💾 Speichern');
    save.addEventListener('click', () => {
      toast('💾', saveGame(G.s) ? 'Gespeichert' : 'Speichern fehlgeschlagen');
    });
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'title' }, '💾 Spielstand'),
      h('div', { class: 'sub', style: 'margin:4px 0 10px' }, 'Wird automatisch auf diesem Gerät gespeichert. Mit dem Export-Code kannst du ihn sichern oder auf ein anderes Gerät übertragen.'),
      h('div', { class: 'upg-actions', style: 'flex-wrap:wrap' }, save, exp, imp),
    ));

    // Installation
    if (!isStandalone) {
      el.appendChild(h('div', { class: 'card' },
        h('div', { class: 'title' }, '📲 Als App installieren'),
        h('div', { class: 'sub', style: 'margin-top:4px' }, isIOS
          ? 'Tippe in Safari unten auf „Teilen“ (□↑) und dann auf „Zum Home-Bildschirm“. Danach startet Cosmo Tycoon im Vollbild wie eine echte App – auch offline.'
          : 'Öffne die Seite auf dem iPhone in Safari, tippe auf „Teilen“ und dann „Zum Home-Bildschirm“.'),
      ));
    }

    const backupVersion = hasPreUpdateBackup();
    if (backupVersion) {
      const restore = h('button', { class: 'btn small ghost' }, '🛟 Stand vor dem Update laden');
      restore.addEventListener('click', () => restoreDialog());
      el.appendChild(h('div', { class: 'card' },
        h('div', { class: 'title' }, '🛟 Sicherung vor dem Update'),
        h('div', { class: 'sub', style: 'margin:4px 0 10px' }, `Vor dem Update auf Version ${backupVersion + 1} wurde dein alter Spielstand unverändert gesichert. Nur für den Notfall – normalerweise brauchst du das nicht.`),
        restore,
      ));
    }

    const reset = h('button', { class: 'btn small red' }, '🗑️ Spiel zurücksetzen');
    reset.addEventListener('click', () => resetDialog());
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'title' }, 'ℹ️ Über Cosmo Tycoon'),
      h('div', { class: 'sub', style: 'margin:4px 0 10px' }, `Version ${APP_VERSION} · Ein Weltraum-Idle-Tycoon. Keine Werbung, keine Käufe – nur du und das Universum.`),
      reset,
    ));
  }

  function update(): void {
    for (const u of updaters) u();
  }

  return { el, build, update, title: 'Mehr' };
}

function exportDialog(): void {
  const code = exportCode(G.s);
  const ta = h('textarea', { class: 'code', readonly: true }, code) as HTMLTextAreaElement;
  showModal({
    hero: '📤',
    title: 'Spielstand-Code',
    body: ['Kopiere diesen Code und bewahre ihn sicher auf (z. B. in Notizen).', ta],
    actions: [
      {
        label: '📋 Kopieren',
        cls: 'violet',
        onClick: () => {
          ta.select();
          void navigator.clipboard?.writeText(code).then(
            () => toast('📋', 'Code kopiert'),
            () => toast('⚠️', 'Kopieren nicht möglich', 'Markiere den Text manuell'),
          );
          return false;
        },
      },
      ...(typeof navigator.share === 'function'
        ? [{ label: '📤 Teilen …', cls: 'ghost', onClick: () => { void navigator.share({ title: 'Cosmo Tycoon Spielstand', text: code }).catch(() => {}); return false; } }]
        : []),
      { label: 'Fertig', cls: 'ghost' },
    ],
  });
}

function importDialog(): void {
  const ta = h('textarea', { class: 'code', placeholder: 'CT1:…' }) as HTMLTextAreaElement;
  const err = h('div', { class: 'sub', style: 'color:var(--bad);margin-top:6px' }, '');
  showModal({
    hero: '📥',
    title: 'Spielstand importieren',
    body: ['Füge deinen Spielstand-Code ein. <b>Achtung:</b> Der aktuelle Spielstand wird überschrieben.', ta, err],
    actions: [
      {
        label: '📥 Importieren',
        cls: 'violet',
        onClick: () => {
          try {
            const st = importCode(ta.value);
            G.s = st;
            saveGame(G.s);
            onReplaceState?.();
            toast('✅', 'Spielstand geladen');
            return true;
          } catch (e) {
            err.textContent = (e as Error).message;
            sfx.error();
            return false;
          }
        },
      },
      { label: 'Abbrechen', cls: 'ghost' },
    ],
  });
}

function restoreDialog(): void {
  showModal({
    hero: '🛟',
    title: 'Alten Stand laden?',
    body: ['Dein aktueller Fortschritt seit dem Update wird durch die Sicherung ersetzt. Tipp: Exportiere vorher deinen aktuellen Stand.'],
    actions: [
      {
        label: '🛟 Sicherung laden',
        cls: 'violet',
        onClick: () => {
          const st = loadPreUpdateBackup();
          if (!st) {
            toast('⚠️', 'Keine Sicherung gefunden');
            return;
          }
          G.s = st;
          saveGame(G.s);
          onReplaceState?.();
          toast('✅', 'Sicherung geladen');
        },
      },
      { label: 'Abbrechen', cls: 'ghost' },
    ],
  });
}

function resetDialog(): void {
  showModal({
    hero: '⚠️',
    title: 'Wirklich alles löschen?',
    body: ['Dein gesamter Fortschritt geht verloren – Sternenstaub, Planeten, Kristalle, Erfolge. Das kann nicht rückgängig gemacht werden.', 'Tipp: Exportiere vorher deinen Spielstand.'],
    actions: [
      {
        label: 'Ja, weiter …',
        cls: 'red',
        onClick: () => {
          setTimeout(() => {
            showModal({
              hero: '🗑️',
              title: 'Letzte Warnung',
              body: 'Bist du dir absolut sicher?',
              actions: [
                {
                  label: '🗑️ Endgültig löschen',
                  cls: 'red',
                  onClick: () => {
                    wipeSave();
                    G.s = defaultState();
                    saveGame(G.s);
                    onReplaceState?.();
                    toast('🌱', 'Neues Spiel gestartet');
                  },
                },
                { label: 'Abbrechen', cls: 'ghost' },
              ],
            });
          }, 250);
        },
      },
      { label: 'Abbrechen', cls: 'ghost' },
    ],
  });
}

