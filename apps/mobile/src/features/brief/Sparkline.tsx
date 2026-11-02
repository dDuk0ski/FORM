import Svg, { Circle, Polyline } from 'react-native-svg';

type SparklineProps = { values: number[]; color: string; width?: number; height?: number };

// A minimal trend line with a dot on the latest value.
export function Sparkline({ values, color, width = 120, height = 44 }: SparklineProps) {
  if (values.length < 2) return null;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }));
  const last = points[points.length - 1];
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={last.x} cy={last.y} r={4} fill={color} />
    </Svg>
  );
}
