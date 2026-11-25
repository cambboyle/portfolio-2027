import { buildInfo, footerLine } from "./buildInfo";

/** A quiet line at the bottom of every page: when this was built, from which commit. */
export function Footer() {
  return (
    <footer className="site-footer">
      <p>{footerLine(buildInfo())}</p>
    </footer>
  );
}
