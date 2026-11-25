/**
 * Facts about this build, for the footer: when it was built, which commit, and how many commits there are. The build
 * script (scripts/build.tsx) puts them in `process.env.BUILD_INFO` for the prerender and swaps the same text into the
 * browser bundle, so both renders match. The dev server has none, and the footer then says so.
 */
export interface BuildInfo {
  /** ISO date, e.g. "2026-11-25". */
  date: string;
  sha: string | null;
  commits: number | null;
}

export function buildInfo(): BuildInfo | null {
  let raw: string | undefined;
  try {
    raw = process.env.BUILD_INFO;
  } catch {
    return null; // in the browser without a build: there is no process
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.date === "string" ? { date: v.date, sha: v.sha ?? null, commits: v.commits ?? null } : null;
  } catch {
    return null;
  }
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** e.g. "built 25 nov 2026 · b3a3675 · 152 commits · audited on every push". */
export function footerLine(info: BuildInfo | null): string {
  if (!info) return "a development build · audited on every push";
  const [y, m, d] = info.date.split("-").map(Number);
  const parts = [`built ${d} ${MONTHS[m - 1]} ${y}`];
  if (info.sha) parts.push(info.sha);
  if (info.commits) parts.push(`${info.commits} commits`);
  parts.push("audited on every push");
  return parts.join(" · ");
}
