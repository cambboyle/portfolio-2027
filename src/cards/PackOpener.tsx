import { useEffect, useRef, useState } from "react";
import { stillness } from "../motion";
import { CardView } from "./CardView";
import { type Pull, rollPack } from "./collection";
import { deck, keepPulls, takePackWish } from "./store";

// a sealed pack, drawn in characters; the zigzags are where it tears
const PACK = [
  "/\\/\\/\\/\\/\\/\\/\\/\\/\\",
  "|                |",
  "|   ..  :  ..    |",
  "|  .:+*#%#*+:.   |",
  "|  :*%@@@@@%*:   |",
  "|  .:+*#%#*+:.   |",
  "|   ..  :  ..    |",
  "|                |",
  "|  PROJECT CARDS |",
  "|   3 per pack   |",
  "|                |",
  "\\/\\/\\/\\/\\/\\/\\/\\/\\/",
].join("\n");

const TEAR_MS = 520;

/** Open a pack: it tears, deals three cards face down, and you turn each one over. What you pull is kept. */
export function PackOpener() {
  const [stage, setStage] = useState<"sealed" | "tearing" | "dealt">("sealed");
  const [pulls, setPulls] = useState<Pull[]>([]);
  const [shown, setShown] = useState<boolean[]>([]);
  const [said, setSaid] = useState("");
  const packButton = useRef<HTMLButtonElement>(null);

  const open = () => {
    const next = rollPack(deck, Math.random);
    keepPulls(next);
    setPulls(next);
    setShown(next.map(() => false));
    setSaid("");
    if (stillness()) setStage("dealt");
    else {
      setStage("tearing");
      setTimeout(() => setStage("dealt"), TEAR_MS);
    }
  };

  // arriving from the terminal's `pack`: open one straight away
  useEffect(() => {
    if (takePackWish()) open();
  }, []);

  const reveal = (i: number) => {
    const next = shown.map((s, n) => (n === i ? !s : s));
    setShown(next);
    if (next.every(Boolean)) {
      const names = pulls.map((p) => `${deck.find((c) => c.slug === p.slug)!.name}${p.foil ? " (foil)" : ""}`);
      setSaid(`You pulled ${names.join(", ")}.`);
    }
  };

  return (
    <section className="pack-area" aria-labelledby="pack-heading">
      <h2 id="pack-heading">Open a pack</h2>
      {stage !== "dealt" ? (
        <button ref={packButton} type="button" className={`pack${stage === "tearing" ? " tearing" : ""}`} onClick={open} disabled={stage === "tearing"}>
          <pre aria-hidden="true">{PACK}</pre>
          <span className="pack-label">{stage === "tearing" ? "opening…" : "open a pack"}</span>
        </button>
      ) : (
        <>
          <p className="muted">Turn them over. One in eight comes out foil.</p>
          <div className="dealt">
            {pulls.map((p, i) => (
              <div key={i} className="dealt-slot" style={{ animationDelay: `${i * 90}ms` }}>
                <CardView card={deck.find((c) => c.slug === p.slug)!} foil={p.foil} flipped={!shown[i]} onFlip={() => reveal(i)} />
              </div>
            ))}
          </div>
          {shown.every(Boolean) && (
            <button type="button" className="text-button" onClick={open}>
              open another
            </button>
          )}
        </>
      )}
      <p className="sr-only" aria-live="polite">{said}</p>
    </section>
  );
}
