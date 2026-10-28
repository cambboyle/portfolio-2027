import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

/** The current path, kept in state so a click on a <Link> swaps the page without reloading it. */
export function usePath(initial?: string) {
  const [path, setPath] = useState(initial ?? location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
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
    dispatchEvent(new PopStateEvent("popstate"));
    scrollTo(0, 0);
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
