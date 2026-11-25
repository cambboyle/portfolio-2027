import { useEffect, useRef, useState } from "react";
import type { Card } from "./cards";
import { CardView } from "./CardView";

/**
 * One card brought up close: the page behind blurs, the card grows in the middle of the screen, and it still tilts
 * and turns over. Escape, the close button or a click outside the card puts it back. While it is open, focus stays
 * inside it, and it returns to where it was afterwards.
 */
export function CardFocus({ card, foil, count, onClose }: { card: Card; foil: boolean; count?: number; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLButtonElement>(".card-focus-close")?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind stays put
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !box.current) return;
      // keep Tab inside: from the last control back to the first, and the other way with Shift
      const stops = [...box.current.querySelectorAll<HTMLElement>("button")];
      const i = stops.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        stops[stops.length - 1].focus();
      } else if (!e.shiftKey && i === stops.length - 1) {
        e.preventDefault();
        stops[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      back?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      className="card-focus"
      role="dialog"
      aria-modal="true"
      aria-label={`The ${card.name} card, up close`}
      onClick={(e) => {
        // a click on the blurred page (not on the card) closes it
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card-focus-stage">
        <CardView card={card} foil={foil} count={count} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
      </div>
      <button type="button" className="card-focus-close" onClick={onClose} aria-label="Put the card back">
        esc
      </button>
    </div>
  );
}
