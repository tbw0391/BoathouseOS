// Shared by the live boat list and its map.
export const STALE_AFTER_MS = 60000;

export const FALLBACK_COLOR = "#6b7280";

export function ageLabel(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)} min`;
}

// Colors come from the database (a coxswain could write anything there), so
// only a plain #rrggbb is ever put into a style.
export const boatColor = (color: string | null) =>
  color && /^#[0-9a-f]{6}$/i.test(color) ? color : FALLBACK_COLOR;
