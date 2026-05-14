export const ACCENT_STORAGE_KEY = "wit-accent";
export const ACCENT_OPTIONS = [
  "default",
  "pine",
  "mint",
  "cyan",
  "violet",
  "amber",
] as const;
export type AccentName = (typeof ACCENT_OPTIONS)[number];

export const FONT_PRESET_STORAGE_KEY = "wit-font-preset";
export const TEXT_SIZE_STORAGE_KEY = "wit-text-size";
export const COLOR_SCHEME_STORAGE_KEY = "wit-color-scheme";

export type FontPresetName = "default" | "literary" | "document" | "plain";
export type TextSizeName = "default" | "large" | "granny";

const FONT_PRESET_VALUES: readonly FontPresetName[] = [
  "default",
  "literary",
  "document",
  "plain",
];
const TEXT_SIZE_VALUES: readonly TextSizeName[] = [
  "default",
  "large",
  "granny",
];

export function isAccentName(value: string): value is AccentName {
  return (ACCENT_OPTIONS as readonly string[]).includes(value);
}

export function isFontPresetName(value: string): value is FontPresetName {
  return (FONT_PRESET_VALUES as readonly string[]).includes(value);
}

export function isTextSizeName(value: string): value is TextSizeName {
  return (TEXT_SIZE_VALUES as readonly string[]).includes(value);
}

export function readStoredAccent(): AccentName {
  if (typeof window === "undefined") {
    return "default";
  }
  const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return raw && isAccentName(raw) ? raw : "default";
}

export function readStoredFontPreset(): FontPresetName {
  if (typeof window === "undefined") {
    return "default";
  }
  const raw = window.localStorage.getItem(FONT_PRESET_STORAGE_KEY);
  return raw && isFontPresetName(raw) ? raw : "default";
}

export function readStoredTextSize(): TextSizeName {
  if (typeof window === "undefined") {
    return "default";
  }
  const raw = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
  return raw && isTextSizeName(raw) ? raw : "default";
}

export function readStoredColorScheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }
  const raw = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark") {
    return raw;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
