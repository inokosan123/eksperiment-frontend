import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Lock } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { C, F } from '@/constants/tokens';
import AllowanceDial from './AllowanceDial';
import FocusSwitch from './FocusSwitch';
import { RegisterWeave } from './ProtectionRegister';
import Bloom from './Bloom';
import { withAlpha } from './GroupSeal';
import { deep, lit } from '@/components/shared/tone';
import { formatMinutesShort } from './dayPlanStore';

// The one fact a rule owns, on a plate.
//
// Two faces of one object. Under a LIMIT it is the allowance: the dial from the
// rule switch grown up, the duration beside it, and the share of the whole it
// takes underneath. Under a BLOCK it is that same instrument with its ring
// closed and a lock where the share would be, and it answers the question every
// blocking app answers — when does it open again.
//
// ⚠️ It is shared by the group and by a single app deliberately. They are the
// same decision at two scopes, and a group's plate and an app's plate that
// looked different would say they were different kinds of thing.

const ROSE = '#A24351';
const ROSE_BORDER = '#E7C4CB';

/**
 * The plate's own ground, lit by whichever state it is in.
 *
 * ⚠️ It derives everything from `blocked` and nothing from a tone passed in.
 * The tone used to arrive as a prop computed from the GROUP's mode, so an app
 * set to Blocked inside a group set to Limit drew a rose ring and a rose lock
 * on the group's own colour — the one surface on the sheet that could disagree
 * with itself. A surface owns its own light.
 */
function PlateGround({ blocked, accent }: { blocked: boolean; accent: string }) {
  const ink = blocked ? ROSE : accent;
  return (
    <>
      {/* Blocked takes the rose parchment the closed plaque wears one section
          above; a limit takes a whisper of the room's colour that has given up
          by the middle of the plate. Neither is white — a plate that states the
          rule's one fact should not be the same ground as the sheet. */}
      <LinearGradient
        colors={blocked
          ? ['#FFF8F9', '#FDEFF1', '#FFFCFC']
          : [`${accent}12`, `${accent}05`, '#FFFEFD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <RegisterWeave color={ink} />
      {/* Gathered behind the dial, where the instrument is. */}
      <View pointerEvents="none" style={s.groundBloom}>
        <Bloom color={ink} opacity={blocked ? 0.3 : 0.34} />
      </View>
      {/* The light every raised surface in this app catches along its top. */}
      <LinearGradient
        colors={[`${ink}00`, `${ink}59`, `${ink}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.groundLit}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[s.groundEdge, { backgroundColor: ink }]} />
    </>
  );
}

export default function RulePlate({
  blocked,
  minutes,
  wholeMinutes,
  accent,
  emoji,
  fallbackLabel,
  sessionName,
  checkInOn,
  onToggleCheckIn,
  onPress,
  compact = false,
}: {
  blocked: boolean;
  /** The allowance, or null for "no limit yet". */
  minutes: number | null;
  /** What the allowance is a share OF — the day, or the group's own limit. */
  wholeMinutes: number | null;
  /** The room's colour. The plate reddens itself when blocked. */
  accent: string;
  /** Shown in the empty ring when there is no share to draw. */
  emoji?: string;
  fallbackLabel: string;
  sessionName?: string;
  /** Omit both to leave the check-in row off entirely. */
  checkInOn?: boolean;
  onToggleCheckIn?: () => void;
  onPress?: () => void;
  /** Inside an app's card the plate sits on a card already, so it flattens. */
  compact?: boolean;
}) {
  const share = !blocked && wholeMinutes && minutes != null
    ? Math.min(1, minutes / wholeMinutes)
    : 0;
  const dialSize = compact ? 50 : 58;
  const dialStroke = compact ? 3.5 : 4;

  if (blocked) {
    return (
      <Animated.View
        key="closed"
        entering={FadeIn.duration(200)}
        style={[s.plate, compact && s.plateCompact, { borderColor: ROSE_BORDER }]}
      >
        <PlateGround blocked accent={accent} />
        <View style={[s.row, compact && s.rowCompact]}>
          <AllowanceDial size={dialSize} strokeWidth={dialStroke} fraction={1} accent={ROSE}>
            <Lock s={compact ? 18 : 21} c={ROSE} w={2} />
          </AllowanceDial>
          {/* ⚠️ NOT the allowance's big-figure treatment. That size is reserved
              for a number you set; "all day" is a consequence of the choice,
              not a quantity. The emphasis goes where every blocking app puts
              it — on WHEN IT OPENS. */}
          <View style={s.copy}>
            <Text style={s.closedTitle} numberOfLines={1}>
              {sessionName ? 'Closed this session' : 'Closed all day'}
            </Text>
            <Text style={s.closedOpens} numberOfLines={1}>
              Opens again{' '}
              <Text style={[s.closedOpensFigure, { color: ROSE }]}>
                {sessionName ? `next ${sessionName}` : 'tomorrow'}
              </Text>
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      key="allowance"
      entering={FadeIn.duration(200)}
      style={[s.plate, compact && s.plateCompact, { borderColor: withAlpha(accent, 0.3) }]}
    >
      <PlateGround blocked={false} accent={accent} />
      <TouchableOpacity
        style={[s.row, compact && s.rowCompact]}
        onPress={onPress}
        disabled={!onPress}
        haptic="selection"
        activeOpacity={0.76}
        accessibilityRole="button"
        accessibilityLabel={`Time limit, ${minutes == null ? 'no limit' : formatMinutesShort(minutes)}`}
      >
        {/* When there is nothing to measure the ring holds a face rather than
            standing empty — the room's own glyph for a group, and for an app
            the SQUIRCLE its real iOS icon will sit in. ⚠️ It must not be a
            circle there: an app icon cropped to a round hole loses its corners,
            and this is the same seat the card above the plate already uses. */}
        <AllowanceDial size={dialSize} strokeWidth={dialStroke} fraction={share} accent={accent}>
          {share > 0 ? (
            <Text style={[s.dialPercent, compact && s.dialPercentCompact, { color: accent }]}>
              {Math.round(share * 100)}
              <Text style={[s.dialUnit, compact && s.dialUnitCompact]}>%</Text>
            </Text>
          ) : emoji ? (
            <NotoEmoji name={emoji} size={compact ? 21 : 25} />
          ) : (
            <View
              style={[
                s.iconSeat,
                { backgroundColor: lit(accent, 99), borderColor: lit(accent, 78, 45) },
              ]}
            >
              <View pointerEvents="none" style={s.iconSeatWell} />
              <Text style={[s.iconSeatText, { color: deep(accent, 40, 45) }]}>
                {fallbackLabel.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </AllowanceDial>

        <View style={s.copy}>
          <View style={s.lead}>
            <Text style={s.name} numberOfLines={1}>Time limit</Text>
            <Animated.Text
              key={minutes ?? 'none'}
              entering={FadeIn.duration(180)}
              style={minutes == null ? s.empty : [s.value, { color: accent }]}
              numberOfLines={1}
            >
              {minutes == null ? 'No limit' : formatMinutesShort(minutes)}
            </Animated.Text>
          </View>
          {/* Only when there is a whole to be a part of. */}
          {minutes != null && wholeMinutes != null && (
            <Text style={s.of} numberOfLines={1}>
              of {compact ? 'the group’s ' : 'your '}
              <Text style={s.ofFigure}>{formatMinutesShort(wholeMinutes)}</Text>
              {compact ? '' : ' day'}
            </Text>
          )}
        </View>
        {!!onPress && <ChevronRight s={17} c={accent} w={2.1} />}
      </TouchableOpacity>

      {minutes != null && onToggleCheckIn && (
        <>
          <View style={[s.line, compact && s.lineCompact]} />
          <View style={[s.checkRow, compact && s.checkRowCompact]}>
            <Text style={s.checkLabel} numberOfLines={1}>15-minute check-ins</Text>
            <FocusSwitch value={!!checkInOn} onToggle={onToggleCheckIn} />
          </View>
        </>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // ⚠️ No shadow here either, and for the same reason as the app card: this
  // view clips its own contents (the ground fills it corner to corner), and
  // `overflow: 'hidden'` masks the layer, which clips the shadow it casts.
  // What survives is a smear that stops dead at the left and right edges. The
  // plate is raised by its ground, its lit top edge and its border instead.
  plate: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 14,
  },
  // The pool sits behind the dial rather than washing the plate: spread wide it
  // was too thin to register as light at all.
  groundBloom: { position: 'absolute', left: -18, top: -22, width: 116, height: 104 },
  groundLit: { position: 'absolute', left: 16, right: 16, top: 0, height: 1 },
  groundEdge: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  // On an app's card the plate is already sitting on a raised surface, so it
  // gives up its own lift and tightens.
  plateCompact: { borderRadius: 15, paddingHorizontal: 11 },
  row: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 13 },
  rowCompact: { paddingVertical: 9, gap: 11 },
  dialPercent: { fontFamily: F.serifBold, fontSize: 19, lineHeight: 22, fontVariant: ['tabular-nums'] },
  dialPercentCompact: { fontSize: 16, lineHeight: 19 },
  dialUnit: { fontFamily: F.serifMedium, fontSize: 11 },
  dialUnitCompact: { fontSize: 9.5 },
  // 30 on 10 is iOS's own corner-to-side ratio, the same one the app card's
  // seat is cut to — so the icon reads as the same object at two sizes.
  iconSeat: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Cut in, so the icon sits IN the seat rather than on it.
  iconSeatWell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9,
    borderCurve: 'continuous',
    boxShadow: 'inset 0 1.5px 3px rgba(72, 60, 35, 0.14), inset 0 -1px 0 rgba(255, 255, 255, 0.7)',
  },
  iconSeatText: { fontFamily: F.serifSemiBold, fontSize: 13 },
  copy: { flex: 1, minWidth: 0 },
  lead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  name: { flex: 1, minWidth: 0, fontFamily: F.serifSemiBold, fontSize: 16, lineHeight: 20, color: C.text },
  value: {
    flexShrink: 0,
    fontFamily: F.serifBold,
    fontSize: 23,
    lineHeight: 26,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  // "No limit" is an ABSENCE, not a value: at a value's weight it shouted a
  // headline about nothing being there.
  empty: { flexShrink: 0, fontFamily: F.serifMedium, fontSize: 16, lineHeight: 20, color: C.textMuted },
  of: { marginTop: 3, fontFamily: F.serif, fontSize: 13, lineHeight: 17, color: C.textSecondary },
  ofFigure: { fontFamily: F.serifSemiBold, color: C.text, fontVariant: ['tabular-nums'] },
  // Full-bleed, so the check-in row reads as its own register rather than as a
  // second line of the allowance.
  line: { height: StyleSheet.hairlineWidth, marginHorizontal: -14, backgroundColor: '#E6E0D2' },
  lineCompact: { marginHorizontal: -11 },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkRowCompact: { minHeight: 46 },
  checkLabel: { flex: 1, minWidth: 0, fontFamily: F.serifSemiBold, fontSize: 16, lineHeight: 20, color: C.text },

  closedTitle: { fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 21, color: C.text },
  closedOpens: { marginTop: 4, fontFamily: F.serif, fontSize: 15, lineHeight: 19, color: C.textSecondary },
  closedOpensFigure: { fontFamily: F.serifSemiBold },
});
