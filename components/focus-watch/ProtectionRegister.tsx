import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
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

const s = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    top: 14,
    bottom: 14,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    opacity: 0.85,
  },
  edgeTall: { top: 18, bottom: 18 },

  seal: {
    flexShrink: 0,
    marginHorizontal: 5.5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { flex: 1, minWidth: 0, paddingLeft: 3 },
  name: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 20, letterSpacing: -0.15 },
  meta: { marginTop: 3, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15.5, color: C.textSecondary },
  tail: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueBlock: { maxWidth: 96, alignItems: 'flex-end' },
  value: { fontFamily: F.serifSemiBold, fontSize: 15.5, fontVariant: ['tabular-nums'] },
  valueCaption: { marginTop: 1, fontFamily: F.sansBold, fontSize: 6.5, letterSpacing: 0.9, color: C.textMuted },

  chip: {
    minWidth: 56,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5.5,
    alignItems: 'center',
  },
  chipText: { fontFamily: F.serifSemiBold, fontSize: 14, lineHeight: 17 },
});
