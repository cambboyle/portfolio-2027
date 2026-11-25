import { type RefObject, useEffect, useRef } from "react";
import { type Settings, updateSettings, useSettings } from "./settings";

const ROWS: { key: "trail" | "idle" | "comets"; label: string; hint: string }[] = [
  { key: "trail", label: "cursor trail", hint: "characters follow the mouse" },
  { key: "idle", label: "screensaver", hint: "after a minute of nothing" },
  { key: "comets", label: "comets", hint: "now and then, on the light theme" },
];

/** A small, quiet panel of switches. Escape or a click outside closes it; focus goes back to the button that opened it. */
export function SettingsPanel({ onClose, opener }: { onClose: () => void; opener: RefObject<HTMLButtonElement | null> }) {
  const settings: Settings = useSettings();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !opener.current?.contains(target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose, opener]);

  return (
    <div ref={panel} className="settings-panel" role="dialog" aria-label="Settings">
      {ROWS.map(({ key, label, hint }) => (
        <label key={key} className="setting">
          <input type="checkbox" checked={settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
          <span className="setting-box" aria-hidden="true">{settings[key] ? "[x]" : "[ ]"}</span>
          <span>
            {label}
            <small>{hint}</small>
          </span>
        </label>
      ))}
      {settings.cometsCaught > 0 && <p className="setting-note">comets caught: {settings.cometsCaught}</p>}
    </div>
  );
}
