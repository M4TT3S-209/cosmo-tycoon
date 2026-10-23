// Zahlen- und Zeitformatierung (deutsches Dezimalkomma)

export type Notation = 'short' | 'sci';

const SUFFIXES = [
  '', 'K', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trio', 'Trd', 'Quad', 'Qrd', 'Quin', 'Qnd',
  'Sext', 'Sxd', 'Sept', 'Spd', 'Okt', 'Okd', 'Non', 'Nod', 'Dez', 'Dzd',
];

let notation: Notation = 'short';
export function setNotation(n: Notation): void {
  notation = n;
}

function comma(s: string): string {
  return s.replace('.', ',');
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Buchstaben-Suffix nach den benannten: aa, ab, … zz */
function letterSuffix(group: number): string {
  const i = group - SUFFIXES.length;
  const a = Math.floor(i / 26);
  const b = i % 26;
  if (a >= 26) return 'e' + group * 3;
  return String.fromCharCode(97 + a) + String.fromCharCode(97 + b);
}

/** Formatiert eine Zahl kompakt: 12,3 K · 4,56 Mio · 1,2 aa */
export function fmt(n: number, smallDecimals = true): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n < 0) return '-' + fmt(-n, smallDecimals);
  if (n < 1000) {
    if (!smallDecimals || n >= 100) return String(Math.floor(n));
    if (n >= 10) return comma(trimZeros(n.toFixed(1)));
    return comma(trimZeros(n.toFixed(2)));
  }
  if (notation === 'sci') {
    const e = Math.floor(Math.log10(n));
    let m = n / Math.pow(10, e);
    let exp = e;
    if (m >= 9.995) {
      m /= 10;
      exp += 1;
    }
    return comma(m.toFixed(2)) + 'e' + exp;
  }
  let group = Math.floor(Math.log10(n) / 3);
  let mant = n / Math.pow(10, group * 3);
  // Rundung kann 999,95 → 1000 erzeugen
  if (mant >= 999.5) {
    group += 1;
    mant /= 1000;
  }
  const digits = mant < 10 ? 2 : mant < 100 ? 1 : 0;
  const str = comma(trimZeros(mant.toFixed(digits)));
  const suf = group < SUFFIXES.length ? SUFFIXES[group] : letterSuffix(group);
  return str + ' ' + suf;
}

/** Ganzzahl mit Tausenderpunkten (für kleine Zähler) */
export function fmtInt(n: number): string {
  if (n >= 1e6) return fmt(n);
  return Math.floor(n).toLocaleString('de-DE');
}

/** Prozent ohne Nachkommastellen bei großen Werten */
export function fmtPct(fraction: number): string {
  const p = fraction * 100;
  if (p >= 1000) return fmt(p, false) + ' %';
  if (p >= 10) return Math.round(p) + ' %';
  return comma(trimZeros(p.toFixed(1))) + ' %';
}

export function fmtMult(m: number): string {
  if (m >= 1000) return '×' + fmt(m);
  if (m >= 100) return '×' + Math.round(m);
  return '×' + comma(trimZeros(m.toFixed(m >= 10 ? 1 : 2)));
}

/** Dauer in Sekunden → "1 h 23 min", "45 s", "2 T 3 h" */
export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return '∞';
  sec = Math.max(0, sec);
  if (sec < 10) return comma(trimZeros(sec.toFixed(1))) + ' s';
  if (sec < 60) return Math.floor(sec) + ' s';
  const m = Math.floor(sec / 60);
  if (m < 60) {
    const s = Math.floor(sec % 60);
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    const mm = m % 60;
    return mm ? `${h} h ${mm} min` : `${h} h`;
  }
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d} T ${hh} h` : `${d} T`;
}

/** Countdown "m:ss" oder "h:mm:ss" */
export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
export function roman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
