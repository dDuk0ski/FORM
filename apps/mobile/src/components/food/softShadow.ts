import type { ViewStyle } from 'react-native';

import type { ColorTokens } from '@/theme';

/**
 * The soft drop shadow under cards, rows and round buttons in the food frames. Color comes
 * from the `shadow` token; only opacity, blur and offset live here.
 */
export function softShadow(colors: ColorTokens): ViewStyle {
  return {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };
}
