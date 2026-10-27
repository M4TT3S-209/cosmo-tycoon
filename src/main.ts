import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { ensureQuests, trackDay } from './core/meta';
import { simulateOffline } from './core/offline';
import { emit } from './core/bus';
import { loadGame, saveGame } from './core/save';
import { tick } from './core/tick';
import { compute } from './core/economy';
import { G } from './ui/ctx';
import { buildApp, dailyDialog, frameUi, offlineDialog } from './ui/app';
import { showIntro, showWhatsNew, tutorialActive } from './ui/tutorial';
import { toast } from './ui/fx';
import { installAudioUnlock, resumeAudio, suspendAudio } from './audio/sfx';
import { initDebug } from './ui/debug';
import { APP_VERSION } from './data/changelog';

/** ab dieser Abwesenheit gibt es den „Willkommen zurück“-Dialog */
const OFFLINE_MIN_SEC = 45;
/** kürzere Pausen (App kurz im Hintergrund) werden still nachgerechnet */
const SILENT_MIN_SEC = 2;

function boot(): void {
  const now = Date.now();
  const res = loadGame(now);
  G.s = res.state;
  G.now = now;
  // Debug-Werkzeuge nur in der Entwicklungsversion
  G.debug = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');

  const root = document.getElementById('app')!;
  buildApp(root);
  if (G.debug) {
    initDebug(root);
    (window as unknown as { __G: typeof G }).__G = G;
  }

  compute(G.s, now, G.calc);
  trackDay(G.s, now);
  ensureQuests(G.s);

  if (res.restoredFromBackup) toast('🛟', 'Spielstand wiederhergestellt', 'Der letzte Speicherstand war beschädigt – Backup geladen.');

  if (res.fresh || G.s.tutorial.step === 0) {
    G.s.tutorial.flags.v2intro = true;
    G.s.tutorial.flags.v21intro = true;
    G.s.tutorial.flags.v3intro = true;
    G.s.tutorial.flags.v31intro = true;
    G.s.seenVersion = APP_VERSION;
    showIntro(() => {
      G.s.tutorial.step = 1;
      saveGame(G.s);
    });
  } else {
    showWhatsNew();
    checkOffline();
    if (!tutorialActive()) dailyDialog();
  }

  // Tippen schaltet Audio frei (iOS-Vorgabe) – bleibt aktiv, falls iOS den Ton später pausiert
  installAudioUnlock();

  // Kein Pinch-Zoom / Doppeltipp-Zoom in Safari
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveGame(G.s);
      suspendAudio();
    } else {
      resumeAudio();
      checkOffline();
      if (!tutorialActive()) dailyDialog();
    }
  });
  window.addEventListener('pagehide', () => saveGame(G.s));
  setInterval(() => saveGame(G.s), 5000);

  try {
    void navigator.storage?.persist?.();
  } catch {
    /* nicht unterstützt */
  }

  registerSW({
    immediate: true,
    // iOS hält die App oft tagelang im Hintergrund – beim Zurückwechseln deshalb nach Updates suchen
    // (ein neues Update lädt die Seite dann automatisch neu, der Spielstand wird vorher gespeichert)
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void reg.update().catch(() => {});
      });
    },
  });
  requestAnimationFrame(loop);
}

/** Zeit seit der letzten Aktivität als Offline-Einnahmen gutschreiben */
function checkOffline(): void {
  const now = Date.now();
  const away = (now - G.s.lastActive) / 1000;
  G.s.lastActive = now;
  lastTs = performance.now();
  if (away < SILENT_MIN_SEC) return;
  const r = simulateOffline(G.s, away, now);
  saveGame(G.s);
  if (away >= OFFLINE_MIN_SEC && (r.earned > 0 || r.bought > 0 || r.supernovas > 0 || r.built.length > 0 || r.mega.length > 0)) offlineDialog(r);
  else {
    // kurze Pause (App kurz im Hintergrund): fertige Bauten wie gewohnt melden
    for (const b of r.built) emit('colonyBuilt', b);
    for (const m of r.mega) emit('megaDone', m);
  }
}

let lastTs = performance.now();
function loop(ts: number): void {
  const now = Date.now();
  G.now = now;
  // Sprung (App war eingefroren, ohne visibilitychange) → wie offline behandeln
  if ((now - G.s.lastActive) / 1000 > SILENT_MIN_SEC) checkOffline();
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 1);
  tick(G.s, dt, now, G.calc, G.out);
  frameUi(dt);
  requestAnimationFrame(loop);
}

boot();
