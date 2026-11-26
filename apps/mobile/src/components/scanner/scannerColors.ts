import { colors } from '@/theme';

// The scanner is a camera surface, which is dark in both light and dark mode, so it always
// reads the DARK palette from src/theme.ts. No new tokens: each mockup color maps to the
// closest existing dark token (see docs/FOOD_LOGGING.md, "Barcode scanning").
const dark = colors.dark;

export const scannerColors = {
  /** Mockup #000000 → shadow (#000000). */
  camera: dark.shadow,
  /** Mockup #525253 → chipBorder (#3A3F48), the closest gray. */
  panel: dark.chipBorder,
  /** Mockup white title, brackets and labels → onPrimary (#FFFFFF). */
  onCamera: dark.onPrimary,
  /** Mockup pill #65995D → success (#3FB950), the closest green. */
  caption: dark.success,
  /** Dark text on the green pill: white on #3FB950 would fail WCAG AA contrast. */
  onCaption: dark.stepperText,
  /** Mockup scan line #8AD48E → link (#4ADE80), the closest bright green. */
  scanLine: dark.link,
  field: dark.surface,
  fieldText: dark.text,
  fieldBorder: dark.textMuted,
  fieldPlaceholder: dark.textMuted,
  fieldError: dark.danger,
} as const;
