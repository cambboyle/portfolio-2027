import { type PointerEvent, useRef } from "react";
import { stillness } from "../motion";
import { backArt, cardArt } from "./art";
import { type Card, TYPE_MARKS, TYPE_NAMES } from "./cards";

const BACK = backArt().join("\n");

/**
 * One card. It tilts towards the pointer, and a foil catches the light as it does; the flip button (or a click on
 * the card) turns it over. With reduced motion, or the animations paused, it stays flat.
 */
export function CardView({
  card,
  foil,
  flipped,
  onFlip,
  onOpen,
  count,
}: {
  card: Card;
  foil: boolean;
  flipped: boolean;
  onFlip: () => void;
  /** If given, a click on the card brings it up close instead of turning it over (the ↻ button still turns it). */
  onOpen?: () => void;
  count?: number;
}) {
  const el = useRef<HTMLElement>(null);

  const tilt = (e: PointerEvent<HTMLElement>) => {
    const node = el.current;
    if (!node || stillness()) return;
    const box = node.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width; // 0 at the left edge, 1 at the right
    const y = (e.clientY - box.top) / box.height;
    node.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
    node.style.setProperty("--rx", `${(0.5 - y) * 16}deg`);
    node.style.setProperty("--mx", `${x * 100}%`);
    node.style.setProperty("--my", `${y * 100}%`);
    node.classList.add("tilting");
  };
  const settle = () => {
    const node = el.current;
    if (!node) return;
    for (const p of ["--rx", "--ry", "--mx", "--my"]) node.style.removeProperty(p);
    node.classList.remove("tilting");
  };

  const label = `${card.name}, ${TYPE_NAMES[card.type]} card, ${card.hp} HP, ${card.rarity}${foil ? ", foil" : ""}`;
  return (
    <article
      ref={el}
      className={`card${flipped ? " flipped" : ""}${foil ? " foil" : ""}`}
      data-type={card.type}
      aria-label={label}
      onPointerMove={tilt}
      onPointerLeave={settle}
      onClick={(e) => {
        // a click anywhere on the card turns it over (the button inside does the same for keyboards)
        if ((e.target as HTMLElement).closest("button")) return;
        if (onOpen) onOpen();
        else onFlip();
      }}
    >
      <div className="card-inner">
        <div className="card-face card-front" aria-hidden={flipped}>
          <header className="card-top">
            <b>{card.name}</b>
            <span>{card.hp} HP</span>
          </header>
          <pre className="card-art" aria-hidden="true">{cardArt(card.name).join("\n")}</pre>
          <p className="card-type">
            <span className="card-mark" aria-hidden="true">{TYPE_MARKS[card.type]}</span> {TYPE_NAMES[card.type]} · {card.stack}
          </p>
          <ul className="card-attacks">
            {card.attacks.map((a) => (
              <li key={a.name}>
                <span className="card-attack-name">{a.name}</span>
                <span className="card-power">{a.power}</span>
                <small>{a.text}</small>
              </li>
            ))}
          </ul>
          <p className="card-flavour">{card.flavour}</p>
          <footer className="card-foot">
            <span>{card.number}</span>
            <span>{card.rarity}{foil ? " · foil" : ""}{count && count > 1 ? ` · ×${count}` : ""}</span>
          </footer>
          {foil && <div className="card-foil" aria-hidden="true" />}
        </div>
        <div className="card-face card-back" aria-hidden={!flipped}>
          <pre aria-hidden="true">{BACK}</pre>
        </div>
      </div>
      <button type="button" className="card-flip" aria-pressed={flipped} aria-label={`Turn the ${card.name} card over`} onClick={onFlip}>
        ↻
      </button>
      {onOpen && (
        <button type="button" className="card-open" aria-label={`Look closer at the ${card.name} card`} onClick={onOpen}>
          ⤢
        </button>
      )}
    </article>
  );
}
