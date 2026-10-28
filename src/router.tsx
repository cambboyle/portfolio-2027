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

export function Link({ to, children }: { to: string; children: ReactNode }) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    history.pushState(null, "", to);
    dispatchEvent(new PopStateEvent("popstate"));
    scrollTo(0, 0);
  };
  return (
    <a href={to} onClick={go}>
      {children}
    </a>
  );
}
