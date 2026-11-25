import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useKonami } from "./konami";
import { PauseButton } from "./PauseButton";
import { navigate } from "./router";
import { getBodyOverride, nextBody, setBodyOverride } from "./sky/control";
import { readTheme } from "./theme";

// the settings panel and the terminal are only needed once someone opens them
const SettingsPanel = lazy(() => import("./SettingsPanel").then((m) => ({ default: m.SettingsPanel })));
const Terminal = lazy(() => import("./Terminal").then((m) => ({ default: m.Terminal })));

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** Bottom right of every page: the terminal, pausing the animations, and a very quiet settings panel. */
export function Dock() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const terminalButton = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const openTerminal = () => {
    returnTo.current = document.activeElement as HTMLElement | null;
    setSettingsOpen(false);
    setTerminalOpen(true);
  };
  const closeTerminal = () => {
    setTerminalOpen(false);
    (returnTo.current ?? terminalButton.current)?.focus();
  };

  // the Konami code: back to the globe, and on to the next body
  useKonami(() => {
    if (location.pathname !== "/") navigate("/");
    setBodyOverride(nextBody(getBodyOverride() ?? (readTheme() === "light" ? "earth" : "moon")));
  });

  // the backtick key opens the terminal from anywhere (unless you are typing somewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "`" || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      e.preventDefault();
      if (terminalOpen) closeTerminal();
      else openTerminal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className="dock">
      {terminalOpen && (
        <Suspense fallback={null}>
          <Terminal onClose={closeTerminal} />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            onClose={() => {
              setSettingsOpen(false);
              settingsButton.current?.focus();
            }}
            opener={settingsButton}
          />
        </Suspense>
      )}
      <button
        ref={terminalButton}
        type="button"
        className="dock-button"
        aria-label="Terminal"
        aria-expanded={terminalOpen}
        aria-haspopup="dialog"
        title="Terminal ( ` )"
        onClick={() => (terminalOpen ? closeTerminal() : openTerminal())}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5l4 3.5-4 3.5M8.5 12H13" />
        </svg>
      </button>
      <PauseButton />
      <button
        ref={settingsButton}
        type="button"
        className="dock-button"
        aria-label="Settings"
        aria-expanded={settingsOpen}
        aria-haspopup="dialog"
        title="Settings"
        onClick={() => setSettingsOpen(!settingsOpen)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>
    </div>
  );
}
