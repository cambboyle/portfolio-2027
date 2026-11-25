import { useEffect } from "react";

const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

// for each position, how much of the start of the code is also the end of what has been typed so far, so a slip
// (or an extra Up arrow at the start) falls back to where it still fits instead of starting again from nothing
const FALLBACK: number[] = [0];
for (let i = 1, k = 0; i < CODE.length; i++) {
  while (k > 0 && CODE[i] !== CODE[k]) k = FALLBACK[k - 1];
  if (CODE[i] === CODE[k]) k++;
  FALLBACK[i] = k;
}

/** How far through the code you are after pressing a key. */
export function konamiStep(progress: number, key: string): number {
  const k = key.length === 1 ? key.toLowerCase() : key;
  let j = progress === CODE.length ? FALLBACK[CODE.length - 1] : progress;
  while (j > 0 && k !== CODE[j]) j = FALLBACK[j - 1];
  return k === CODE[j] ? j + 1 : 0;
}

export const KONAMI_LENGTH = CODE.length;

/** Calls `onCode` when the Konami code is typed anywhere on the page (but not while typing in a field). */
export function useKonami(onCode: () => void) {
  useEffect(() => {
    let progress = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      progress = konamiStep(progress, e.key);
      if (progress === KONAMI_LENGTH) {
        progress = 0;
        onCode();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCode]);
}
