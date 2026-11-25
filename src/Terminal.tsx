import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { setPaused, useMotionPaused } from "./motion";
import { navigate } from "./router";
import { updateSettings, useSettings } from "./settings";
import { setBodyOverride, setIssTracking, summonComet, useBodyOverride, useIssTracking } from "./sky/control";
import { type Action, type Env, complete, run } from "./terminal/commands";
import { type Theme, useTheme } from "./theme";
import { changeTheme } from "./themeTransition";

interface Line {
  kind: "in" | "out";
  text: string;
}

// kept for the visit, so closing and reopening the terminal brings back what was there
let kept: Line[] = [{ kind: "out", text: "cam@portfolio. type help." }];
const history: string[] = [];

/** A small shell at the bottom of the screen: it knows the site's pages and a few of its secrets. */
export function Terminal({ onClose }: { onClose: () => void }) {
  const theme: Theme = useTheme() ?? "dark";
  const paused = useMotionPaused();
  const settings = useSettings();
  const body = useBodyOverride();
  const iss = useIssTracking();
  const [path, setPath] = useState(() => location.pathname);
  const [lines, setLines] = useState<Line[]>(kept);
  const [input, setInput] = useState("");
  const recall = useRef(-1);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
    const onPop = () => setPath(location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    kept = lines;
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines]);

  const env = (): Env => ({ now: new Date(), path, theme, paused, settings, body, iss });

  const apply = (a: Action) => {
    if (a.type === "navigate") navigate(a.to);
    else if (a.type === "theme") void changeTheme(a.theme);
    else if (a.type === "pause") setPaused(a.paused);
    else if (a.type === "settings") updateSettings(a.patch);
    else if (a.type === "body") setBodyOverride(a.body);
    else if (a.type === "comet") summonComet();
    else if (a.type === "iss") setIssTracking(a.on);

    else if (a.type === "clear") setLines([]);
    else onClose();
  };

  const submit = () => {
    const text = input;
    const result = run(text, env());
    if (text.trim()) history.push(text);
    recall.current = -1;
    setInput("");
    const printed: Line[] = [{ kind: "in", text }, ...result.lines.map((t): Line => ({ kind: "out", text: t }))];
    // "clear" empties the screen, so it is applied after the new lines are added
    setLines((old) => [...old, ...printed].slice(-200));
    for (const a of result.actions ?? []) apply(a);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "Enter") submit();
    else if (e.key === "Tab") {
      // Tab completes; focus stays here, which is also what keeps it inside the dialog
      e.preventDefault();
      if (!e.shiftKey) setInput(complete(input, env()));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (!history.length) return;
      recall.current =
        e.key === "ArrowUp" ? Math.min(history.length - 1, recall.current + 1) : Math.max(-1, recall.current - 1);
      setInput(recall.current === -1 ? "" : history[history.length - 1 - recall.current]);
    } else if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      setLines([]);
    } else if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      setInput("");
    }
  };

  const prompt = `cam@portfolio:~${path === "/" ? "" : path}$`;
  return (
    <div className="terminal" role="dialog" aria-modal="true" aria-label="Terminal" onClick={() => field.current?.focus()}>
      <div ref={log} className="terminal-log" role="log" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={l.kind === "in" ? "terminal-in" : undefined}>
            {l.kind === "in" ? `${prompt} ${l.text}` : l.text}
          </div>
        ))}
      </div>
      <label className="terminal-row">
        <span className="terminal-prompt" aria-hidden="true">{prompt}</span>
        <span className="sr-only">Command</span>
        <input
          ref={field}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
      </label>
      <button type="button" className="terminal-close" onClick={onClose} aria-label="Close terminal">
        esc
      </button>
    </div>
  );
}
