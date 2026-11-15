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

export const TYPEFACE_STORAGE_KEY = "wit-typeface";
export const SIZE_BUMP_STORAGE_KEY = "wit-size-bump";

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
/** @deprecated Read only for migration into `wit-typeface`. */
const LEGACY_FONT_PRESET_STORAGE_KEY = "wit-font-preset";
/** @deprecated Read only for migration into `wit-size-bump`. */
const LEGACY_TEXT_SIZE_STORAGE_KEY = "wit-text-size";
const LEGACY_TEXT_SIZE_VALUES: Record<string, SizeBumpName> = {
  default: "none",
  large: "x1.15",
  granny: "x1.3",
};

export type TypefaceName = "default" | "literary" | "document" | "blog";
export type SizeBumpName = "none" | "x1.15" | "x1.3" | "x1.5";

const TYPEFACE_VALUES: readonly TypefaceName[] = [
  "default",
  "literary",
  "document",
  "blog",
];
const SIZE_BUMP_VALUES: readonly SizeBumpName[] = [
  "none",
  "x1.15",
  "x1.3",
  "x1.5",
];
const BG_THEME_VALUES: readonly BgThemeName[] = [
  "default",
  ...BG_THEME_PALETTE_OPTIONS,
];

export function isAccentName(value: string): value is AccentName {
  return (ACCENT_OPTIONS as readonly string[]).includes(value);
}

export function isTypefaceName(value: string): value is TypefaceName {
  return (TYPEFACE_VALUES as readonly string[]).includes(value);
}

export function isSizeBumpName(value: string): value is SizeBumpName {
  return (SIZE_BUMP_VALUES as readonly string[]).includes(value);
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

export function readStoredTypeface(): TypefaceName {
  if (typeof window === "undefined") {
    return "default";
  }
  const raw =
    window.localStorage.getItem(TYPEFACE_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_FONT_PRESET_STORAGE_KEY);
  // Retired `plain` used the face Default now uses.
  return raw && isTypefaceName(raw) ? raw : "default";
}

export function readStoredSizeBump(): SizeBumpName {
  if (typeof window === "undefined") {
    return "none";
  }
  const raw = window.localStorage.getItem(SIZE_BUMP_STORAGE_KEY);
  if (raw && isSizeBumpName(raw)) {
    return raw;
  }
  const legacy = window.localStorage.getItem(LEGACY_TEXT_SIZE_STORAGE_KEY);
  return (legacy && LEGACY_TEXT_SIZE_VALUES[legacy]) || "none";
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

export const HIDE_UI_STORAGE_KEY = "wit-hide-ui";

/** `"1"` is on. Missing, `"0"`, and any other string are off. */
export function readStoredHideUi(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(HIDE_UI_STORAGE_KEY) === "1";
}
