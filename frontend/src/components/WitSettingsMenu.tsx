import { useEffect, useRef } from "react";

import {
  type AccentName,
  BG_THEME_MENU_OPTIONS,
  type BgThemeName,
  type FontPresetName,
  type TextSizeName,
  isAccentName,
  isBgThemeName,
  isFontPresetName,
  isTextSizeName,
} from "../lib/witAppearance";

const ACCENT_OPTIONS: { value: AccentName; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "pine", label: "Pine" },
  { value: "mint", label: "Mint" },
  { value: "cyan", label: "Cyan" },
  { value: "violet", label: "Violet" },
  { value: "scarlet", label: "Scarlet" },
  { value: "amber", label: "Amber" },
];

const FONT_PRESET_OPTIONS: { value: FontPresetName; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "literary", label: "Literary" },
  { value: "document", label: "Document" },
  { value: "plain", label: "Plain" },
];

const TEXT_SIZE_OPTIONS: { value: TextSizeName; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "granny", label: "Granny" },
];

/**
 * Rendered as SVG (not the U+2699 glyph) because the gear character's inked
 * shape isn't centered within its own em-box in most fonts — flexbox can
 * only center the box, not the ink, which is what made it look off relative
 * to the round hover background. A geometric icon centers exactly.
 */
function GearIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  accent: AccentName;
  onAccentChange: (next: AccentName) => void;
  fontPreset: FontPresetName;
  onFontPresetChange: (next: FontPresetName) => void;
  textSize: TextSizeName;
  onTextSizeChange: (next: TextSizeName) => void;
  bgTheme: BgThemeName;
  onBgThemeChange: (next: BgThemeName) => void;
};

export function WitSettingsMenu({
  accent,
  onAccentChange,
  fontPreset,
  onFontPresetChange,
  textSize,
  onTextSizeChange,
  bgTheme,
  onBgThemeChange,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = detailsRef.current;
    if (!el) {
      return;
    }

    const syncOpenClass = () => {
      document.documentElement.classList.toggle("wit-settings-open", el.open);
    };
    syncOpenClass();
    el.addEventListener("toggle", syncOpenClass);

    const onDocumentClick = (e: MouseEvent) => {
      if (!el.open) {
        return;
      }
      const t = e.target;
      if (t instanceof Node && !el.contains(t)) {
        el.open = false;
      }
    };
    document.addEventListener("click", onDocumentClick);

    return () => {
      el.removeEventListener("toggle", syncOpenClass);
      document.removeEventListener("click", onDocumentClick);
      document.documentElement.classList.remove("wit-settings-open");
    };
  }, []);

  return (
    <details ref={detailsRef} className="wit-app-settings">
      <summary className="wit-app-settings-summary" aria-label="Settings">
        <GearIcon />
      </summary>
      <div className="wit-app-settings-panel">
        <div className="wit-settings-rows">
          <label className="wit-settings-row">
            <span className="wit-settings-row-label">Style</span>
            <select
              value={fontPreset}
              onChange={(e) => {
                const v = e.target.value;
                if (isFontPresetName(v)) {
                  onFontPresetChange(v);
                }
              }}
              aria-label="Typography style"
            >
              {FONT_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="wit-settings-row">
            <span className="wit-settings-row-label">Page Size</span>
            <select
              value={textSize}
              onChange={(e) => {
                const v = e.target.value;
                if (isTextSizeName(v)) {
                  onTextSizeChange(v);
                }
              }}
              aria-label="Page editor text size (sidebar and header stay fixed)"
            >
              {TEXT_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="wit-settings-row">
            <span className="wit-settings-row-label">Accent</span>
            <select
              value={accent}
              onChange={(e) => {
                const v = e.target.value;
                if (isAccentName(v)) {
                  onAccentChange(v);
                }
              }}
              aria-label="Accent palette"
            >
              {ACCENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="wit-settings-row">
            <span className="wit-settings-row-label">Background</span>
            <select
              value={bgTheme}
              onChange={(e) => {
                const v = e.target.value;
                if (isBgThemeName(v)) {
                  onBgThemeChange(v);
                }
              }}
              aria-label="Background palette (System follows OS light/dark)"
            >
              {BG_THEME_MENU_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </details>
  );
}
