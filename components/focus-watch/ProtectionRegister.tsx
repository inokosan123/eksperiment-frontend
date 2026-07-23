import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { ChevronRight } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import Bloom from './Bloom';

// The register: the card material the Always Blocked row wears inside the plan
// builder, lifted out so every surface that speaks about a standing boundary —
// the main Focus screen's rows, the sheet those rows open — is cut from the
// same cloth.
//
// The anatomy is a white ground rather than a tinted one; the colour arrives as
// light instead of paint: a faint diagonal weave, two blooms (a wide wash that
// dies before the right edge, and a tighter pool gathered under the seal), and
// a bar of the accent down the left edge. That is what makes the card feel lit
// rather than filled, and it is the part worth carrying everywhere.

export type RegisterTone = {
  accent: string;
  tint: string;
  border: string;
  title: string;
  chevron: string;
};

export const REGISTER_TONES: Record<'rose' | 'gold', RegisterTone> = {
  rose: { accent: '#A24351', tint: '#FBE9EC', border: '#E7C4CB', title: '#6A2637', chevron: '#C08894' },
  gold: { accent: '#8B6B2F', tint: '#FBF3DE', border: '#E7D9B9', title: '#59400F', chevron: '#B49254' },
};

// The faint diagonal weave every lit focus card wears. Pattern ids are derived
// from the colour so two tones on one screen never collide in the SVG defs.
export function RegisterWeave({ color }: { color: string }) {
  const patternId = `register-weave-${color.replace(/[^a-z0-9]/gi, '')}`;
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
}

// Everything behind the content: wash, weave, the two blooms and the edge bar.
// `tall` shifts the light up toward the head of a taller card so the pool still
// gathers under the seal rather than in the middle of the body.
export function RegisterGround({ tone, tall = false }: { tone: RegisterTone; tall?: boolean }) {
  return (
    <>
      <LinearGradient
        colors={['#FFFEFC', '#FFFDFB', '#FFFEFD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <RegisterWeave color={tone.accent} />
      <View pointerEvents="none" style={[s.washBloom, tall && s.washBloomTall]}>
        <Bloom color={tone.accent} opacity={0.15} />
      </View>
      <View pointerEvents="none" style={[s.sealBloom, tall && s.sealBloomTall]}>
        <Bloom color={tone.accent} opacity={0.22} />
      </View>
      <View pointerEvents="none" style={[s.edge, tall && s.edgeTall, { backgroundColor: tone.accent }]} />
    </>
  );
}

// The disc the register's icon sits in — a ring of the accent over its tint.
export function RegisterSeal({
  tone,
  size = 42,
  children,
  style,
}: {
  tone: RegisterTone;
  size?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        s.seal,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.tint, borderColor: `${tone.accent}4D` },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// The standing pill on the right of a register row.
export function RegisterChip({ tone, label }: { tone: RegisterTone; label: string }) {
  return (
    <View style={[s.chip, { backgroundColor: tone.tint, borderColor: tone.border }]}>
      <Text style={[s.chipText, { color: tone.accent }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── How hard a boundary holds ──────────────────────────────────────────────
// Loose and Strict are the two strengths the whole Focus tab speaks in, so the
// control that chooses between them is worth getting right once.
//
// The old version filled the chosen half with its own loud tint — yellow next
// to pink, two colours fighting on one small control. Here the fill is a WHITE
// raised pill that SLIDES between the halves on a spring, the way a physical
// switch would, and the colour lives in the ink: a dot and the label take the
// strength's accent when chosen, and go quiet when not. One colour lit at a
// time, and the movement tells you what happened.
export type RegisterStrength = 'loose' | 'strict';

const STRENGTH_INK: Record<RegisterStrength, { accent: string; label: string }> = {
  loose: { accent: '#9A7526', label: 'Loose' },
  strict: { accent: '#A24351', label: 'Strict' },
};

export function RegisterStrengthControl({
  value,
  onChange,
  compact = false,
}: {
  value: RegisterStrength;
  onChange: (next: RegisterStrength) => void;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = value === 'strict' ? 1 : 0;
  const pos = useSharedValue(index);

  // The pill follows the selection; the spring is the same family the rest of
  // the Focus tab uses for anything that snaps into place.
  useEffect(() => {
    pos.value = reduceMotion ? index : withSpring(index, { damping: 19, stiffness: 210, mass: 0.8 });
  }, [index, pos, reduceMotion]);

  const half = trackWidth > 0 ? (trackWidth - STRENGTH_TRACK_PAD * 2) / 2 : 0;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * half }],
  }));

  return (
    <View
      style={[s.strengthTrack, compact && s.strengthTrackCompact]}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
    >
      {half > 0 && (
        <Animated.View pointerEvents="none" style={[s.strengthPill, { width: half }, pillStyle]} />
      )}
      {(['loose', 'strict'] as RegisterStrength[]).map(strength => {
        const selected = value === strength;
        const ink = STRENGTH_INK[strength];
        return (
          <TouchableOpacity
            key={strength}
            style={s.strengthOption}
            onPress={() => onChange(strength)}
            haptic="selection"
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${ink.label} blocking`}
          >
            <View style={[s.strengthDot, { backgroundColor: selected ? ink.accent : '#CFC9BB' }]} />
            <Text
              style={[
                s.strengthLabel,
                compact && s.strengthLabelCompact,
                { color: selected ? ink.accent : C.textMuted },
              ]}
            >
              {ink.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// The line under the control that says what the chosen strength actually does.
// It crossfades on change so the control and its consequence read as one move.
export function RegisterModeNote({ strength, text }: { strength: RegisterStrength; text: string }) {
  const ink = STRENGTH_INK[strength];
  return (
    <View style={[s.modeNote, { backgroundColor: `${ink.accent}0F` }]}>
      <View style={[s.modeNoteDot, { backgroundColor: ink.accent }]} />
      <Animated.Text key={strength} entering={FadeIn.duration(200)} style={s.modeNoteText}>
        {text}
      </Animated.Text>
    </View>
  );
}

// A small standing tally: "2 strict · 1 loose", each half wearing its own ink.
export function RegisterStrengthTally({ strict, loose }: { strict: number; loose: number }) {
  if (strict + loose === 0) return null;
  return (
    <View style={s.tally}>
      {strict > 0 && (
        <View style={s.tallyPart}>
          <View style={[s.strengthDot, { backgroundColor: STRENGTH_INK.strict.accent }]} />
          <Text style={[s.tallyText, { color: STRENGTH_INK.strict.accent }]}>{strict} strict</Text>
        </View>
      )}
      {strict > 0 && loose > 0 && <Text style={s.tallyDot}>·</Text>}
      {loose > 0 && (
        <View style={s.tallyPart}>
          <View style={[s.strengthDot, { backgroundColor: STRENGTH_INK.loose.accent }]} />
          <Text style={[s.tallyText, { color: STRENGTH_INK.loose.accent }]}>{loose} loose</Text>
        </View>
      )}
    </View>
  );
}

// One register row: seal, name and meta, then either a value block or a chip,
// and the chevron. Same reading order and the same weights as the plan
// builder's Always Blocked card.
export default function ProtectionRegisterCard({
  tone,
  icon,
  title,
  detail,
  chipLabel,
  value,
  valueCaption,
  valueColor = C.text,
  index = 0,
  onPress,
  accessibilityLabel,
}: {
  tone: RegisterTone;
  icon: React.ReactNode;
  title: string;
  detail: string;
  chipLabel?: string;
  value?: string;
  valueCaption?: string;
  valueColor?: string;
  index?: number;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(360).delay(index * 55).easing(Easing.out(Easing.cubic))}
      style={[s.card, { borderColor: tone.border }]}
    >
      <RegisterGround tone={tone} />
      <TouchableOpacity
        style={s.row}
        onPress={onPress}
        activeOpacity={0.74}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${title}. ${detail}`}
      >
        <RegisterSeal tone={tone}>{icon}</RegisterSeal>
        <View style={s.body}>
          <Text style={[s.name, { color: tone.title }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>
            {title}
          </Text>
          <Text style={s.meta} numberOfLines={1}>{detail}</Text>
        </View>
        <View style={s.tail}>
          {value != null ? (
            <View style={s.valueBlock}>
              <Text style={[s.value, { color: valueColor }]} numberOfLines={1}>{value}</Text>
              {!!valueCaption && <Text style={s.valueCaption} numberOfLines={1}>{valueCaption}</Text>}
            </View>
          ) : chipLabel ? (
            <RegisterChip tone={tone} label={chipLabel} />
          ) : null}
          <ChevronRight s={16} c={tone.chevron} w={2} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// The track's inner padding — the sliding pill's travel is derived from it.
const STRENGTH_TRACK_PAD = 3.5;

const s = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: C.surface,
    paddingHorizontal: 11,
    paddingVertical: 5,
    boxShadow: '0 6px 16px rgba(35, 40, 37, 0.055)',
  },
  // Two blooms so the colour never hits a seam: a wide, faint wash spanning the
  // whole card that fades out before the right edge, and a tighter, brighter
  // pool centred on the seal.
  washBloom: { position: 'absolute', left: -90, top: -46, width: 440, height: 170 },
  washBloomTall: { top: -66 },
  sealBloom: { position: 'absolute', left: -36, top: -44, width: 152, height: 164 },
  sealBloomTall: { left: -30, top: -54, width: 168, height: 180 },
  edge: {
    position: 'absolute',
    left: 0,
    top: 11,
    bottom: 11,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    opacity: 0.85,
  },
  edgeTall: { top: 18, bottom: 18 },

  seal: {
    flexShrink: 0,
    marginHorizontal: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tighter vertically than the builder's card: on Home this row sits among
  // several others and should not eat the screen.
  row: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { flex: 1, minWidth: 0, paddingLeft: 2 },
  name: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 16.5, lineHeight: 19, letterSpacing: -0.15 },
  meta: { marginTop: 1.5, fontFamily: F.sans, fontSize: 11, lineHeight: 14.5, color: C.textSecondary },
  tail: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueBlock: { maxWidth: 96, alignItems: 'flex-end' },
  value: { fontFamily: F.serifSemiBold, fontSize: 15.5, fontVariant: ['tabular-nums'] },
  valueCaption: { marginTop: 1, fontFamily: F.sansBold, fontSize: 6.5, letterSpacing: 0.9, color: C.textMuted },

  chip: {
    minWidth: 52,
    borderRadius: 11,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    alignItems: 'center',
  },
  chipText: { fontFamily: F.serifSemiBold, fontSize: 13.5, lineHeight: 16 },

  // The strength control: neutral track, white sliding pill, ink in the label.
  strengthTrack: {
    position: 'relative',
    height: 44,
    flexDirection: 'row',
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    backgroundColor: '#F4F1EA',
    padding: STRENGTH_TRACK_PAD,
  },
  strengthTrackCompact: { height: 38, borderRadius: 13 },
  strengthPill: {
    position: 'absolute',
    left: STRENGTH_TRACK_PAD,
    top: STRENGTH_TRACK_PAD,
    bottom: STRENGTH_TRACK_PAD,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(35,40,37,0.06)',
    boxShadow: '0 2px 6px rgba(45, 40, 33, 0.10)',
  },
  strengthOption: {
    flex: 1,
    minWidth: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  strengthDot: { width: 6, height: 6, borderRadius: 3 },
  strengthLabel: { fontFamily: F.sansBold, fontSize: 12.5, letterSpacing: 0.1 },
  strengthLabelCompact: { fontSize: 11.5 },

  modeNote: {
    marginTop: 9,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 13,
    borderCurve: 'continuous',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  modeNoteDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  modeNoteText: { flex: 1, fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: C.textSecondary },

  tally: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tallyPart: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tallyText: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 0.2 },
  tallyDot: { fontFamily: F.sans, fontSize: 11, color: C.textMuted },
});
