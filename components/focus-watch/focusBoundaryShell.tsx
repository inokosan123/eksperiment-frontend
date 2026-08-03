import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { AlertTriangle, CheckSmall, Lock } from '@/components/icons/Icons';
import { deep, lit } from '@/components/shared/tone';
import { C, F } from '@/constants/tokens';
import { RULE_TONES } from './focusContent';
import type { FocusBoundaryAppearance } from './todayUsageModel';

// The card material every boundary surface is cut from.
//
// The group cards on the plan board, the app cards inside the group sheet and
// the Today breakdown are the same three objects at three depths, so they are
// built here once rather than approximated in each place. Today used to keep
// its own palette, its own weave and its own row geometry; that is what made a
// group look like one thing while planning and another thing while reviewing.

export type BoundaryTone = {
  /** The state's colour. Ink, markers and rails take it. */
  accent: string;
  /** The card ground. */
  ground: string;
  /** The card edge. */
  edge: string;
  /** The chip ground, cut into the card. */
  badge: string;
  /** Title ink. */
  ink: string;
  /** Supporting copy. */
  body: string;
};

const PARCHMENT_INK = '#3D372F';
const PARCHMENT_BODY = '#6B6459';

/**
 * State, never category.
 *
 * ⚠️ `blocked` and `overLimit` are deliberately both in the red family and sit
 * only 6° apart in hue — measured, not guessed. What separates them is
 * saturation (41 against 83), the marker they carry (a lock against a `!`) and
 * their copy (`BLOCKED` against `OVER BY Xm`). Colour alone must never be
 * asked to tell them apart, because it cannot. A standing block and a broken
 * limit are different events and must never be read as the same one.
 */
export const FOCUS_BOUNDARY_TONES: Record<FocusBoundaryAppearance, BoundaryTone> = {
  pending: {
    accent: '#918B81',
    ground: '#F7F6F2',
    edge: '#DCD8CF',
    badge: '#ECEAE5',
    ink: '#575047',
    body: '#8A8378',
  },
  noLimit: {
    accent: '#716A60',
    ground: '#FFFDF9',
    edge: '#E4E0D7',
    badge: '#F0EEE9',
    ink: PARCHMENT_INK,
    body: PARCHMENT_BODY,
  },
  limitActive: {
    accent: RULE_TONES.limit.color,
    ground: lit(RULE_TONES.limit.color, 97),
    edge: lit(RULE_TONES.limit.color, 82, 55),
    badge: lit(RULE_TONES.limit.color, 93),
    ink: deep(RULE_TONES.limit.color, 26, 46),
    body: deep(RULE_TONES.limit.color, 44, 34),
  },
  blocked: {
    accent: RULE_TONES.blocked.color,
    ground: '#FFF9FA',
    edge: '#EBCED4',
    badge: '#F9E9EC',
    ink: '#6A2637',
    body: '#8A5C66',
  },
  atLimit: {
    accent: C.goldDark,
    ground: '#FBF2DC',
    edge: '#DFC68C',
    badge: '#F1E1BB',
    ink: '#5A420F',
    body: '#7C6634',
  },
  overLimit: {
    accent: C.red,
    ground: '#FFF1F3',
    edge: '#F0BFCA',
    badge: '#FBDDE3',
    ink: '#7B0D28',
    body: '#96505F',
  },
};

export function boundaryTone(appearance: FocusBoundaryAppearance): BoundaryTone {
  return FOCUS_BOUNDARY_TONES[appearance];
}

/**
 * The ribbon recipe the group sheet's app cards are struck from, lifted out so
 * Today's rows are the same object rather than a copy of it.
 *
 * ⚠️ Built in HSL holding hue and saturation and moving only lightness. Mixing
 * a colour toward white drains it — the app's green falls from 72% saturation
 * to 30% that way — which is exactly what a faint wash over white does.
 */
export function focusRibbonPalette(accent: string) {
  return {
    gradient: [lit(accent, 97), lit(accent, 91), lit(accent, 84)] as const,
    border: lit(accent, 78, 62),
    // The seat and chip go near-white so they read as recesses cut INTO the
    // colour. On a coloured ground a tinted inset simply disappears.
    inset: lit(accent, 99),
    insetEdge: lit(accent, 78, 45),
    name: deep(accent, 24, 48),
    value: deep(accent, 32, 48),
    seatInk: deep(accent, 40, 45),
    chevron: deep(accent, 50, 40),
  };
}

export function useFocusRibbonPalette(accent: string) {
  return useMemo(() => focusRibbonPalette(accent), [accent]);
}

/** The faint diagonal weave every lit focus card wears. */
export const CardWeave = memo(function CardWeave({ color }: { color: string }) {
  const patternId = `focus-weave-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id={patternId} width={30} height={30} patternUnits="userSpaceOnUse">
            <Path d="M 0 30 L 30 0" stroke={color} strokeOpacity={0.05} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
});

export type BoundaryMarker = 'none' | 'lock' | 'warning' | 'check';

function ChipMarker({ marker, color }: { marker: BoundaryMarker; color: string }) {
  if (marker === 'lock') return <Lock s={8.5} c={color} w={2.2} />;
  if (marker === 'warning') return <AlertTriangle s={9} c={color} w={2.3} />;
  if (marker === 'check') return <CheckSmall s={9} c={color} w={3} />;
  return null;
}

/**
 * The status chip. Colour is never the only signal, so this always carries a
 * word, and a marker whenever the state has one.
 */
export function BoundaryChip({
  appearance,
  label,
  marker = 'none',
}: {
  appearance: FocusBoundaryAppearance;
  label: string;
  marker?: BoundaryMarker;
}) {
  const tone = boundaryTone(appearance);
  return (
    <View style={[s.chip, { backgroundColor: tone.badge }]}>
      <ChipMarker marker={marker} color={tone.accent} />
      <Text style={[s.chipText, { color: tone.accent }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** The quiet second line a row may carry beside its own state. */
export function BoundarySignalChip({ label, tone }: { label: string; tone: BoundaryTone }) {
  return (
    <View style={[s.signalChip, { borderColor: tone.edge }]}>
      <Text style={[s.signalChipText, { color: tone.body }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/**
 * The over-limit mark, set on the corner of a group or app face.
 *
 * ⚠️ It must stay legible without reading as the configured-block lock: a
 * different shape (a bare stroke and dot, no shackle), a different colour
 * (scarlet, not rose) and no enclosing body.
 */
export function BoundaryWarningMark({
  size = 17,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = FOCUS_BOUNDARY_TONES.overLimit;
  return (
    <View
      pointerEvents="none"
      style={[
        s.warningMark,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.accent },
        style,
      ]}
    >
      <Text style={[s.warningMarkText, { fontSize: size * 0.62 }]}>!</Text>
    </View>
  );
}

/** The lit ground of a boundary card: gradient, weave and a pane of light. */
export function BoundaryGround({
  tone,
  textured = true,
}: {
  tone: BoundaryTone;
  textured?: boolean;
}) {
  return (
    <>
      <LinearGradient
        colors={[lit(tone.accent, 98), tone.ground, lit(tone.accent, 96)]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {textured && <CardWeave color={tone.accent} />}
      {/* A pane of light gathered at the shoulder. It must reach transparent
          well before any edge — a fade that stops mid-card rules a hard line
          across it as cleanly as if one had been drawn. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
        locations={[0, 0.55]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </>
  );
}

/** Capped: going over fills the rail rather than overflowing it. */
export function BoundaryRail({
  fraction,
  tone,
  height = 5,
  style,
}: {
  fraction: number;
  tone: BoundaryTone;
  height?: number;
  style?: object;
}) {
  return (
    <View style={[s.rail, { height, borderRadius: height / 2, backgroundColor: 'rgba(40,33,24,0.08)' }, style]}>
      <View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: tone.accent,
          width: `${Math.min(100, Math.max(0, fraction * 100))}%`,
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  chipText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 0.9 },
  signalChip: {
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
  },
  signalChipText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.9 },
  warningMark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  warningMarkText: {
    fontFamily: F.sansBold,
    color: '#FFFFFF',
    lineHeight: undefined,
    includeFontPadding: false,
  },
  rail: { width: '100%', overflow: 'hidden' },
});
