/**
 * Where the Moon is in its cycle, for a given moment: how far round from new, how much of the face is lit, and what
 * it is called. The Moon's and the sun's longitudes along the ecliptic come from the standard low-precision series
 * (the largest terms of Meeus' Astronomical Algorithms), which is good to well under a degree, so the phase is right
 * to within a few hours.
 */
export interface MoonPhase {
  /** Elongation of the Moon from the sun in radians: 0 at new, π/2 first quarter, π full, 3π/2 last quarter. */
  angle: number;
  /** The lit share of the face, 0 to 1. */
  illumination: number;
  /** Days since new moon (0 to about 29.53). */
  age: number;
  name: "new moon" | "waxing crescent" | "first quarter" | "waxing gibbous" | "full moon" | "waning gibbous" | "last quarter" | "waning crescent";
}

const SYNODIC_MONTH = 29.530588853;
const RAD = Math.PI / 180;
const wrap = (deg: number) => ((deg % 360) + 360) % 360;
const sin = (deg: number) => Math.sin(deg * RAD);

const NAMES: MoonPhase["name"][] = [
  "new moon",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full moon",
  "waning gibbous",
  "last quarter",
  "waning crescent",
];

export function moonPhase(date: Date): MoonPhase {
  // centuries since 1 January 2000, noon
  const T = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000 / 36525;

  // the Moon: mean longitude, mean elongation, the sun's and the Moon's mean anomalies, and the argument of latitude
  const Lm = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mm = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const moon =
    Lm +
    6.288774 * sin(Mm) +
    1.274027 * sin(2 * D - Mm) +
    0.658314 * sin(2 * D) +
    0.213618 * sin(2 * Mm) -
    0.185116 * sin(M) -
    0.114332 * sin(2 * F) +
    0.058793 * sin(2 * D - 2 * Mm) +
    0.057066 * sin(2 * D - M - Mm) +
    0.053322 * sin(2 * D + Mm) +
    0.045758 * sin(2 * D - M) -
    0.040923 * sin(M - Mm) -
    0.034720 * sin(D) -
    0.030383 * sin(M + Mm);

  // the sun
  const L0 = 280.46646 + 36000.76983 * T;
  const sun = L0 + 1.914602 * sin(M) + 0.019993 * sin(2 * M);

  const elongation = wrap(moon - sun);
  const angle = elongation * RAD;
  return {
    angle,
    illumination: (1 - Math.cos(angle)) / 2,
    age: (elongation / 360) * SYNODIC_MONTH,
    name: NAMES[Math.floor(((elongation + 22.5) % 360) / 45)],
  };
}

/**
 * The next moment after `from` when the Moon reaches a given angle from the sun (0 for new, Math.PI for full,
 * Math.PI / 2 first quarter, 3 * Math.PI / 2 last quarter). It scans forward and then narrows the moment down.
 */
export function nextPhase(from: Date, target: number): Date {
  const full = Math.PI * 2;
  // how far round from the target the Moon is: rises steadily, then drops back to 0 at the moment it arrives
  const gap = (t: number) => (((moonPhase(new Date(t)).angle - target) % full) + full) % full;
  const step = 3 * 3600000;
  let a = from.getTime();
  for (let n = 0; n < 250; n++) {
    const b = a + step;
    if (gap(b) < gap(a)) {
      // it passed the target between a and b; halve the interval until it is a minute wide
      let lo = a;
      let hi = b;
      while (hi - lo > 60000) {
        const mid = (lo + hi) / 2;
        if (gap(mid) < gap(lo)) hi = mid;
        else lo = mid;
      }
      return new Date(hi);
    }
    a = b;
  }
  return new Date(a);
}
