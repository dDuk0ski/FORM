import { colors } from '@/theme';

// The scanner is a camera surface, which is dark in both light and dark mode, so it always
// reads the DARK palette from src/theme.ts. No new tokens: each mockup color maps to the
// closest existing dark token (see docs/FOOD_LOGGING.md, "Barcode scanning").
const dark = colors.dark;

export const scannerColors = {
  /** Mockup black camera area → shadow (black in both palettes). */
  camera: dark.shadow,
  /** Mockup mid-gray panel → chipBorder, the closest existing gray (a little darker). */
  panel: dark.chipBorder,
  /** Mockup white title, brackets and labels → onPrimary (white). */
  onCamera: dark.onPrimary,
  /** Mockup muted-green pill → success, the closest existing green. */
  caption: dark.success,
  /** Dark text on the green pill: white on `success` would fail WCAG AA contrast. */
  onCaption: dark.stepperText,
  /** Mockup light-green scan line → link, the closest existing bright green. */
  scanLine: dark.link,
  field: dark.surface,
  fieldText: dark.text,
  fieldBorder: dark.textMuted,
  fieldPlaceholder: dark.textMuted,
  fieldError: dark.danger,
} as const;
