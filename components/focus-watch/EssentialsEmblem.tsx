import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Lock } from '@/components/icons/Icons';

// The Essentials register, third sibling to the Goal's struck trophy and the
// Tolerance shield's tick bezel. A lock is a seal, so this one is beaded like
// one — a ring of small rose beads around the glyph.
//
// `lit` is the emblem on a dark surface (the day is locked); the soft variant
// sits on the rose-cream cards.

const ROSE = '#E14B5A';
const ROSE_DEEP = '#A63A4B';

export function LockSeal({ size = 34, lit = false }: { size?: number; lit?: boolean }) {
  const field = size * 2;
  const cx = field / 2;
  const beadRadius = size * 0.79;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 1.24,
          height: size * 1.24,
          borderRadius: (size * 1.24) / 2,
          backgroundColor: lit ? 'rgba(225,75,90,0.22)' : 'rgba(225,75,90,0.13)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: lit ? 'rgba(255,138,150,0.5)' : 'rgba(198,90,103,0.36)',
          boxShadow: lit ? '0 4px 14px rgba(225,75,90,0.28)' : undefined,
        }}
      />
      <Svg pointerEvents="none" width={field} height={field} style={{ position: 'absolute' }}>
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
          const cardinal = index % 3 === 0;
          return (
            <Circle
              key={index}
              cx={cx + beadRadius * Math.cos(angle)}
              cy={cx + beadRadius * Math.sin(angle)}
              r={cardinal ? size * 0.052 : size * 0.036}
              fill={lit ? '#FF97A2' : ROSE}
              fillOpacity={cardinal ? (lit ? 0.72 : 0.5) : (lit ? 0.46 : 0.3)}
            />
          );
        })}
      </Svg>
      <Lock s={size * 0.55} c={lit ? '#FFD7DC' : ROSE_DEEP} w={1.9} />
    </View>
  );
}

// The same lock blown up as a card watermark, cropped by the card's own edge —
// the Essentials answer to the trophy and shield ghosts.
export function LockGhost({ size, tone = 'dark' }: { size: number; tone?: 'dark' | 'light' }) {
  const stroke = tone === 'dark' ? '#FF9AA5' : ROSE_DEEP;
  const strokeOpacity = tone === 'dark' ? 0.5 : 0.32;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={4}
        y={11}
        width={16}
        height={10}
        rx={2.5}
        fill={stroke}
        fillOpacity={tone === 'dark' ? 0.07 : 0.05}
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={0.34}
      />
      <Path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        fill="none"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={0.34}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16} r={1.3} fill={stroke} fillOpacity={strokeOpacity * 0.8} />
    </Svg>
  );
}
