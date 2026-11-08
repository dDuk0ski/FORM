import Svg, { Circle, G } from 'react-native-svg';

import { withAlpha } from '@/theme';

type Ring = { progress: number; color: string };

type RingsProps = {
  /** Outermost first. Progress is 0 to 1; anything above 1 shows as a full ring. */
  rings: Ring[];
  size?: number;
  stroke?: number;
  gap?: number;
};

// Concentric progress rings in the style of Apple's Activity rings.
export function Rings({ rings, size = 132, stroke = 14, gap = 3 }: RingsProps) {
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      {rings.map((ring, i) => {
        const radius = center - stroke / 2 - i * (stroke + gap);
        const circumference = 2 * Math.PI * radius;
        const progress = Math.min(1, Math.max(0, ring.progress));
        return (
          <G key={i} rotation={-90} origin={`${center}, ${center}`}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={withAlpha(ring.color, 0.18)}
              strokeWidth={stroke}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={ring.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference * progress} ${circumference}`}
              fill="none"
            />
          </G>
        );
      })}
    </Svg>
  );
}
