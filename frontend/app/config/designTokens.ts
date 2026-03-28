/**
 * WIAL Design Token System
 *
 * Typed brand tokens for programmatic access in components.
 * CSS custom properties (defined in globals.css) are the source of truth
 * for Tailwind utility classes. This file provides TypeScript constants
 * for use in JS logic, dynamic styles, and component props.
 *
 * Requirements: 4.6 (consistent branding), 9.1 (system font stack)
 */

/** Certification levels recognized by WIAL */
export type CertificationLevel = "CALC" | "PALC" | "SALC" | "MALC";

/** Brand color palette */
export interface BrandColors {
  readonly blue: string;
  readonly blueLight: string;
  readonly blueDark: string;
  readonly gold: string;
  readonly goldLight: string;
  readonly goldDark: string;
  readonly white: string;
}

/** Semantic color palette */
export interface SemanticColors {
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly info: string;
}

/** Certification badge color mapping */
export interface CertBadgeColors {
  readonly CALC: string;
  readonly PALC: string;
  readonly SALC: string;
  readonly MALC: string;
}

export const brandColors: BrandColors = {
  blue: "#003366",
  blueLight: "#1a5c99",
  blueDark: "#002244",
  gold: "#c8a951",
  goldLight: "#dbc47a",
  goldDark: "#a68b3a",
  white: "#ffffff",
} as const;

export const semanticColors: SemanticColors = {
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
  info: "#2563eb",
} as const;

export const certBadgeColors: CertBadgeColors = {
  CALC: "#2563eb",
  PALC: "#16a34a",
  SALC: "#c8a951",
  MALC: "#7c3aed",
} as const;

/** Certification level display labels */
export const certLabels: Record<CertificationLevel, string> = {
  CALC: "Certified Action Learning Coach",
  PALC: "Professional Action Learning Coach",
  SALC: "Senior Action Learning Coach",
  MALC: "Master Action Learning Coach",
} as const;

/**
 * System font stack — no custom web fonts per Requirement 9.1.
 * Matches the --font-sans CSS custom property in globals.css.
 */
export const systemFontStack =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
