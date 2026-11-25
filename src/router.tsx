import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { navDirection, pageTransition } from "./pageTransition";

// set by a click on a <Link>, so the new page starts at the top (going back or forward keeps the browser's own scroll)
let pushed = false;

/** The current path, kept in state so a click on a <Link> swaps the page without reloading it. */
export function usePath(initial?: string) {
  const [path, setPath] = useState(initial ?? location.pathname);
  const shown = useRef(path);
  useEffect(() => {
    const onPop = () => {
      const to = location.pathname;
      const direction = navDirection(shown.current, to);
      shown.current = to;
      // the page changes inside a sweep of characters; flushSync so the new page is there when the sweep needs it
      pageTransition(() => {
        flushSync(() => setPath(to));
        if (pushed) scrollTo(0, 0);
        pushed = false;
      }, direction);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function Link({ to, children, current }: { to: string; children: ReactNode; current?: boolean }) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    history.pushState(null, "", to);
    pushed = true;
    dispatchEvent(new PopStateEvent("popstate"));
  };
  return (
    <a href={to} onClick={go} aria-current={current ? "page" : undefined}>
      {children}
    </a>
  );
}

/** A link to another site. It opens in a new tab, so say so for people using a screen reader. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
