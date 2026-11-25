import { setPaused, useMotionPaused } from "./motion";

/** Bottom right of the screen: stops the globe turning and the theme animation; press again to carry on. */
export function PauseButton() {
  const paused = useMotionPaused();
  return (
    <button
      type="button"
      className="pause-button"
      aria-label="Pause animations"
      aria-pressed={paused}
      title={paused ? "Resume animations" : "Pause animations"}
      onClick={() => setPaused(!paused)}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
        {paused ? <path d="M4 2.5v11l9.5-5.5z" /> : <path d="M3.5 2h3.2v12H3.5zM9.3 2h3.2v12H9.3z" />}
      </svg>
    </button>
  );
}
