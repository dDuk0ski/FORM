import { colors } from '@/theme';

// The scanner is a camera surface, which is dark in both light and dark mode, so it always
// reads the DARK palette from src/theme.ts. The hint pill and scan line have their own tokens
// (scanHint, scanLine, sampled from the frame); the rest map to the closest existing dark token
// (see docs/FOOD_LOGGING.md, "Barcode scanning").
const dark = colors.dark;

export const scannerColors = {
  /** Mockup black camera area → shadow (black in both palettes). */
  camera: dark.shadow,
  /** Mockup mid-gray panel → chipBorder, the closest existing gray (a little darker). */
  panel: dark.chipBorder,
  /** Mockup white title, brackets and labels → onPrimary (white). */
  onCamera: dark.onPrimary,
  /** Round white back button with a dark chevron, as on the Log food / Add food frames. */
  backButton: dark.onPrimary,
  onBackButton: dark.stepperText,
  /** Mockup muted-green pill. */
  caption: dark.scanHint,
  /**
   * Dark text on the green pill: about 5.3:1. White on scanHint is about 3.4:1, below WCAG AA
   * (4.5:1) for this text size, so the frame's white text is not used.
   */
  onCaption: dark.stepperText,
  /** Mockup thin light-green scan line. */
  scanLine: dark.scanLine,
  field: dark.surface,
  fieldText: dark.text,
  fieldBorder: dark.textMuted,
  fieldPlaceholder: dark.textMuted,
  fieldError: dark.danger,
} as const;
