// Parallax-Sternenhimmel auf Canvas (läuft im Haupt-Loop, ~30 fps)

interface Star {
  x: number;
  y: number;
  z: number; // Tiefe 0.2..1
  tw: number; // Funkel-Phase
  hue: number;
}

let canvas: HTMLCanvasElement;
let c2d: CanvasRenderingContext2D;
let stars: Star[] = [];
let w = 0;
let hgt = 0;
let dpr = 1;
let acc = 0;
let time = 0;
let warp = 0;

export function initStarfield(el: HTMLCanvasElement): void {
  canvas = el;
  c2d = el.getContext('2d')!;
  resize();
  window.addEventListener('resize', resize);
}

function resize(): void {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  w = canvas.clientWidth;
  hgt = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(hgt * dpr);
  c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.min(220, Math.floor((w * hgt) / 2600));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * hgt,
    z: 0.2 + Math.random() * 0.8,
    tw: Math.random() * Math.PI * 2,
    hue: Math.random() < 0.15 ? 30 + Math.random() * 30 : 200 + Math.random() * 60,
  }));
}

/** Kurzer Warp-Effekt (z. B. bei Supernova/Planetenwechsel) */
export function starWarp(seconds = 2): void {
  warp = Math.max(warp, seconds);
}

export function updateStarfield(dt: number): void {
  acc += dt;
  time += dt;
  if (warp > 0) warp = Math.max(0, warp - dt);
  // ~30 fps reichen für den Hintergrund
  if (acc < 1 / 30 && warp <= 0) return;
  const step = acc;
  acc = 0;
  c2d.clearRect(0, 0, w, hgt);
  const speed = 6 + (warp > 0 ? 900 * Math.min(1, warp) : 0);
  for (const s of stars) {
    s.y += s.z * speed * step;
    if (s.y > hgt + 4) {
      s.y = -4;
      s.x = Math.random() * w;
    }
    const a = 0.35 + 0.65 * s.z * (0.6 + 0.4 * Math.sin(time * (1 + s.z * 2) + s.tw));
    const r = 0.4 + s.z * 1.3;
    c2d.fillStyle = `hsla(${s.hue}, 80%, 88%, ${a})`;
    if (warp > 0) {
      const len = Math.min(80, speed * s.z * 0.06);
      c2d.fillRect(s.x - r / 2, s.y - len, r, len);
    } else {
      c2d.beginPath();
      c2d.arc(s.x, s.y, r, 0, Math.PI * 2);
      c2d.fill();
    }
  }
}
