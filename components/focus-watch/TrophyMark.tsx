import Svg, { Path, Rect } from 'react-native-svg';

// A small static trophy glyph — the daily mark of a kept day. The animated
// Lottie trophy (challenge-trophy) is reserved for milestone celebrations;
// grids and strips use this light SVG so 30+ of them cost nothing.
export default function TrophyMark({
  size = 16,
  color = '#C5A059',
  muted = false,
}: {
  size?: number;
  color?: string;
  muted?: boolean;
}) {
  const fill = muted ? '#D6D3D1' : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* cup */}
      <Path
        d="M7 4h10v5.2c0 3-2.1 5.3-5 5.3s-5-2.3-5-5.3V4z"
        fill={fill}
      />
      {/* handles */}
      <Path
        d="M7 5.4H4.6c0 3 1.3 4.8 3.1 5.3M17 5.4h2.4c0 3-1.3 4.8-3.1 5.3"
        stroke={fill}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* stem + base */}
      <Path d="M10.9 14.4h2.2V17h-2.2v-2.6z" fill={fill} />
      <Rect x={8.2} y={17} width={7.6} height={2.1} rx={1.05} fill={fill} />
      <Rect x={6.9} y={19.4} width={10.2} height={1.9} rx={0.95} fill={fill} />
      {/* shine */}
      {!muted && (
        <Path
          d="M9.4 6.2c0 2 .5 3.6 1.4 4.6"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}
