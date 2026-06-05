export const ACCENT_STORAGE_KEY = "wit-accent";
export const ACCENT_OPTIONS = [
  "default",
  "pine",
  "mint",
  "cyan",
  "violet",
  "scarlet",
  "amber",
] as const;
export type AccentName = (typeof ACCENT_OPTIONS)[number];

export const FONT_PRESET_STORAGE_KEY = "wit-font-preset";
export const TEXT_SIZE_STORAGE_KEY = "wit-text-size";

/** User-selected background palette (independent of OS light/dark). */
export const BG_THEME_STORAGE_KEY = "wit-bg-theme";
export const BG_THEME_PALETTE_OPTIONS = [
  "forest",
  "steppe",
  "mountain",
  "ocean",
  "dune",
  "wasteland",
] as const;
export type BgThemePalette = (typeof BG_THEME_PALETTE_OPTIONS)[number];
export type BgThemeName = "default" | BgThemePalette;
export type ColorScheme = "light" | "dark";

const BG_THEME_LABELS: Record<BgThemePalette, string> = {
  forest: "Forest",
  steppe: "Steppe",
  mountain: "Mountain",
  ocean: "Ocean",
  dune: "Dune",
  wasteland: "Wasteland",
};

export const BG_THEME_MENU_OPTIONS: { value: BgThemeName; label: string }[] = [
  { value: "default", label: "System" },
  ...BG_THEME_PALETTE_OPTIONS.map((value) => ({
    value,
    label: BG_THEME_LABELS[value],
  })),
];

/** @deprecated Legacy keys — read only for migration into `wit-bg-theme`. */
const LEGACY_THEME_STORAGE_KEY = "wit-theme";

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
const BG_THEME_VALUES: readonly BgThemeName[] = [
  "default",
  ...BG_THEME_PALETTE_OPTIONS,
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

export function isBgThemeName(value: string): value is BgThemeName {
  return (BG_THEME_VALUES as readonly string[]).includes(value);
}

export function isBgThemePalette(value: string): value is BgThemePalette {
  return (BG_THEME_PALETTE_OPTIONS as readonly string[]).includes(value);
}

export function getSystemColorScheme(): ColorScheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function subscribeSystemColorScheme(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Default follows OS light/dark; named palettes always render their dark scheme. */
export function resolveEffectiveColorScheme(
  bgTheme: BgThemeName,
  systemScheme: ColorScheme,
): ColorScheme {
  return bgTheme === "default" ? systemScheme : "dark";
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

export function readStoredBgTheme(): BgThemeName {
  if (typeof window === "undefined") {
    return "default";
  }

  const raw = window.localStorage.getItem(BG_THEME_STORAGE_KEY);
  if (raw === "oceanic") {
    return "ocean";
  }
  if (raw && isBgThemeName(raw)) {
    return raw;
  }

  const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacyTheme && isBgThemePalette(legacyTheme)) {
    return legacyTheme;
  }

  return "default";
}
