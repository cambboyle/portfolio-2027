import { hashText } from "./cards";

/**
 * Little character pictures for the cards: a night sky, a glowing orb and rolling hills, different for every card
 * but always the same for the same one (made from the card's name). The back of every card is a small globe on a
 * lattice, like the one on the home page.
 */
const SKY = " .  `  .   ";
const RAMP = " .:-=+*#%@";

/** A smooth bumpy line from a seed: the height of the hills at each column, between 0 and 1. */
function hills(seed: number, cols: number) {
  const a = (seed % 97) / 97;
  const b = ((seed >>> 8) % 89) / 89;
  return Array.from({ length: cols }, (_, x) => {
    const t = x / cols;
    return 0.35 + 0.18 * Math.sin(t * 7 + a * 6) + 0.1 * Math.sin(t * 17 + b * 9);
  });
}

export function cardArt(name: string, cols = 24, rows = 8): string[] {
  const seed = hashText(name);
  const ground = hills(seed, cols);
  // the orb: somewhere in the upper part of the sky
  const ox = 4 + (seed % Math.max(1, cols - 8));
  const oy = 1 + ((seed >>> 5) % 2);
  const radius = 1.7 + ((seed >>> 9) % 3) * 0.4;
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const height = (rows - 1 - y) / (rows - 1); // 1 at the top, 0 at the bottom
      // characters are about twice as tall as they are wide, so the orb is squashed to stay round
      const d = Math.hypot((x - ox) / 2, y - oy);
      if (height < ground[x]) {
        // the hills: denser further down
        const depth = (ground[x] - height) / ground[x];
        line += RAMP[Math.min(RAMP.length - 1, 3 + Math.floor(depth * 6))];
      } else if (d < radius) {
        line += RAMP[Math.max(4, RAMP.length - 1 - Math.floor((d / radius) * 5))];
      } else if (d < radius + 0.9) {
        line += ":";
      } else {
        line += SKY[(x * 7 + y * 13 + seed) % SKY.length];
      }
    }
    lines.push(line);
  }
  return lines;
}

/** The back of a card: a lattice with a small globe in the middle. */
export function backArt(cols = 24, rows = 16): string[] {
  const lines: string[] = [];
  const [cx, cy, r] = [(cols - 1) / 2, (rows - 1) / 2, Math.min(cols / 4, rows / 2) * 0.9];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot((x - cx) / 2, y - cy);
      if (d < r - 0.6) {
        // the globe, lit from the left
        const shade = 1 - (x - cx + r * 2) / (r * 4);
        line += RAMP[Math.max(2, Math.min(RAMP.length - 1, Math.round(shade * 9)))];
      } else if (d < r + 0.4) line += "o";
      else line += (x + y) % 4 === 0 ? "/" : (x - y + 64) % 4 === 0 ? "\\" : " ";
    }
    lines.push(line);
  }
  return lines;
}
