/**
 * A small puzzle for people who open the browser's console. The console shows an encoded clue; decoding it gives a
 * phrase; typing `unlock <phrase>` in the terminal earns a special card. The phrase is checked against a SHA-256 hash,
 * so reading the source gives the hash, not the answer. It is all in the browser and changes nothing anywhere else.
 */
export const FLAG_HASH = "0c891d42707ed4a052fb0080702d0fd796421989c096840960a92f702849e4a2";

/** The clue: the phrase, ROT13'd, then base64'd. */
export const CLUE = "Z3VuZydmIGFiIHpiYmE=";

/** Lower case, letters and single spaces only, so punctuation and spacing do not matter. */
export const normaliseGuess = (guess: string) =>
  guess.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

export async function checkFlag(guess: string): Promise<boolean> {
  const bytes = new TextEncoder().encode(normaliseGuess(guess));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === FLAG_HASH;
}

const BANNER = String.raw`
      .-""""-.
    .'  .--.  '.       you opened the console.
   /   ( () )   \
  |  -- '--' --  |     there is a command in the terminal that help does not list:
  |==============|       unlock <answer>
   \            /
    '.        .'       the answer, rot13'd and then base64'd:
      '-....-'           ${CLUE}
`;

/** Shown once in the console when the site starts. An info message, not an error. */
export function printBanner() {
  console.info(BANNER);
}
