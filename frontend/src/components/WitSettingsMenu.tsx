import { useEffect, useRef } from "react";

import {
  type AccentName,
  type FontPresetName,
  type TextSizeName,
  isAccentName,
  isFontPresetName,
  isTextSizeName,
} from "../lib/witAppearance";

const ACCENT_OPTIONS: { value: AccentName; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "pine", label: "Pine" },
  { value: "mint", label: "Mint" },
  { value: "cyan", label: "Cyan" },
  { value: "violet", label: "Violet" },
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

type Props = {
  accent: AccentName;
  onAccentChange: (next: AccentName) => void;
  fontPreset: FontPresetName;
  onFontPresetChange: (next: FontPresetName) => void;
  textSize: TextSizeName;
  onTextSizeChange: (next: TextSizeName) => void;
  colorScheme: "light" | "dark";
  onColorSchemeChange: (next: "light" | "dark") => void;
};

export function WitSettingsMenu({
  accent,
  onAccentChange,
  fontPreset,
  onFontPresetChange,
  textSize,
  onTextSizeChange,
  colorScheme,
  onColorSchemeChange,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      const el = detailsRef.current;
      if (!el?.open) {
        return;
      }
      const t = e.target;
      if (t instanceof Node && !el.contains(t)) {
        el.open = false;
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  return (
    <details ref={detailsRef} className="wit-app-settings">
      <summary className="wit-app-settings-summary" aria-label="Settings">
        ⚙
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
            <span className="wit-settings-row-label">Theme</span>
            <select
              value={colorScheme}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "light" || v === "dark") {
                  onColorSchemeChange(v);
                }
              }}
              aria-label="Light or dark theme"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </div>
    </details>
  );
}
