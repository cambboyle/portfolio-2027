import { useState } from "react";
import "../cards/cards.css";
import { CardFocus } from "../cards/CardFocus";
import { CardView } from "../cards/CardView";
import { PackOpener } from "../cards/PackOpener";
import { type Card, FLAG_CARD } from "../cards/cards";
import { deck, resetCollection, useCollection } from "../cards/store";

/**
 * The cards page: my projects as cards, a pack to open, and a binder. Not connected to the site at the moment (no route
 * in src/App.tsx); add a route, its meta and its place in `routes` (src/meta.ts) to bring it back.
 */
export function Cards() {
  const collection = useCollection();
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [focused, setFocused] = useState<Card | null>(null);
  const pulled = Object.values(collection).reduce((n, o) => n + o.count, 0);
  const foils = deck.filter((c) => collection[c.slug]?.foil).length;
  return (
    <main id="main" tabIndex={-1} className="page cards-page">
      <h1>Cards</h1>
      <p>
        My projects, as collectable cards. Everything on them comes from the project: its type from the stack, its moves
        from the choices in its case study, its rarity from how finished it is.
      </p>
      <PackOpener />
      <section aria-labelledby="binder-heading">
        <h2 id="binder-heading">The binder</h2>
        <p className="muted">
          {pulled ? `${pulled} pulled, ${foils} of ${deck.length} in foil. ` : "Nothing pulled yet. "}
          A foil you pull stays shiny here. Click a card to look closer. Kept in this browser only.
        </p>
        <div className="binder">
          {deck.map((card) => (
            <CardView
              key={card.slug}
              card={card}
              foil={!!collection[card.slug]?.foil}
              count={collection[card.slug]?.count}
              flipped={!!flipped[card.slug]}
              onFlip={() => setFlipped((f) => ({ ...f, [card.slug]: !f[card.slug] }))}
              onOpen={() => setFocused(card)}
            />
          ))}
          {collection[FLAG_CARD.slug] && (
            <CardView
              card={FLAG_CARD}
              foil
              flipped={!!flipped.flag}
              onFlip={() => setFlipped((f) => ({ ...f, flag: !f.flag }))}
              onOpen={() => setFocused(FLAG_CARD)}
            />
          )}
        </div>
        {pulled > 0 && (
          <button type="button" className="text-button" onClick={resetCollection}>
            start again
          </button>
        )}
      </section>
      {focused && (
        <CardFocus
          card={focused}
          foil={focused.slug === FLAG_CARD.slug || !!collection[focused.slug]?.foil}
          count={collection[focused.slug]?.count}
          onClose={() => setFocused(null)}
        />
      )}
    </main>
  );
}
