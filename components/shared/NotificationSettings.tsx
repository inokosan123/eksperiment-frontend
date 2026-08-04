import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Reanimated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BellDouble, BellNone, BellSingle } from '@/components/icons/NotificationBells';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

/* ─────────────────────────────────────────────────────────────
 * THE NOTIFICATION SETTING — none, single, double.
 *
 * Shared by every sheet that schedules a task, so it is worth being
 * right.
 *
 * COLOUR IS THE SECOND VOICE. The three marks already count the
 * setting — no arcs, one, two — and the plates now climb the same
 * ladder, so the row says the same thing twice and can be read
 * without reading:
 *
 *   NONE    white plate, RED edge and mark. Nothing will arrive, and
 *           it is the one choice that is a refusal, so it is the one
 *           colour that is not the accent.
 *   SINGLE  the accent, lightly: a tinted plate, accent edge, accent
 *           ink. Present, quiet.
 *   DOUBLE  the accent, fully: solid plate, white ink. The loudest
 *           setting, and it looks it.
 *
 * ⚠ WHAT WAS WRONG, AND MUST NOT COME BACK: the plate animated and
 * its CONTENTS SNAPPED. Background and border ran through
 * `interpolateColor` over a spring while the icon took
 * `active ? white : grey` and the label took a style-array swap —
 * both change on the frame the state does. The button eased into its
 * colour while the mark and word inside it jumped, which reads as a
 * rendering fault rather than as motion.
 *
 * Everything that changes now runs off ONE shared value per button:
 * plate, border, label, and the icon — which is drawn TWICE and
 * cross-faded, because an SVG's stroke is not a style and cannot
 * ride `interpolateColor`. Same device as the Prayer Book's hour
 * row, and the arriving option hops once, from there too.
 * ───────────────────────────────────────────────────────────── */

export type NotificationMode = 'none' | 'single' | 'double';

type Props = {
  mode: NotificationMode;
  reminderMinutes: number;
  onModeChange: (mode: NotificationMode) => void;
  onReminderChange: (minutes: number) => void;
  label?: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
};

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

const REST_INK = '#A8AFBC';
const REST_EDGE = '#ECE8E0';

/**
 * The mark's size, and the plate that holds it.
 *
 * 20 was the icon-set default and it left the button mostly empty; the mark is
 * the fastest thing in this row to read, so it carries the button. 27 over a
 * 10pt label wants 62 of plate to sit in without crowding either.
 */
const ICON = 27;

function withAlpha(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** What each setting looks like once chosen. See the note above. */
function litPalette(mode: NotificationMode, accent: string) {
  if (mode === 'none') {
    return { plate: '#FFFFFF', edge: C.red, ink: C.red, shadow: C.red, shadowPeak: 0.1 };
  }
  if (mode === 'single') {
    return {
      plate: withAlpha(accent, 0.12),
      edge: accent,
      ink: accent,
      shadow: accent,
      shadowPeak: 0.09,
    };
  }
  return { plate: accent, edge: accent, ink: '#FFFFFF', shadow: accent, shadowPeak: 0.16 };
}

const MODE_OPTIONS = [
  { key: 'none' as const, label: 'None', Icon: BellNone },
  { key: 'single' as const, label: 'Single', Icon: BellSingle },
  { key: 'double' as const, label: 'Double', Icon: BellDouble },
];

function useSelectionMotion(active: boolean) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });
  }, [active, progress]);

  return progress;
}

export default function NotificationSettings({
  mode,
  reminderMinutes,
  onModeChange,
  onReminderChange,
  label = 'Notification',
  accent = C.gold,
  style,
}: Props) {
  return (
    <View style={[s.wrap, style]}>
      {/* Optional so a caller that already names the setting in its own row
          can drop the heading rather than say it twice. Every existing caller
          takes the default and is unaffected. */}
      {!!label && <Text style={[s.label, { color: accent }]}>{label}</Text>}

      <View style={s.modeRow}>
        {MODE_OPTIONS.map(({ key, label: optionLabel, Icon }) => (
          <NotificationModeButton
            key={key}
            mode={key}
            active={mode === key}
            label={optionLabel}
            Icon={Icon}
            accent={accent}
            onPress={() => onModeChange(key)}
          />
        ))}
      </View>

      {mode === 'double' && (
        <ReminderTrack accent={accent} reminderMinutes={reminderMinutes} onReminderChange={onReminderChange} />
      )}
    </View>
  );
}

function NotificationModeButton({
  mode,
  active,
  label,
  Icon,
  accent,
  onPress,
}: {
  mode: NotificationMode;
  active: boolean;
  label: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  accent: string;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSelectionMotion(active);
  const hop = useSharedValue(0);
  const press = useSharedValue(0);
  const lit = litPalette(mode, accent);

  useEffect(() => {
    // Only the arriving option hops, and only when it arrives.
    if (!active || reduceMotion) return;
    hop.value = withSequence(
      withTiming(-4, { duration: 130, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 9, stiffness: 300, mass: 0.6 }),
    );
  }, [active, hop, reduceMotion]);

  const plateStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', lit.plate]),
    borderColor: interpolateColor(progress.value, [0, 1], [REST_EDGE, lit.edge]),
    shadowOpacity: 0.015 + progress.value * lit.shadowPeak,
    transform: [
      { translateY: hop.value + press.value * 1.5 },
      { scale: 1 + progress.value * 0.018 - press.value * 0.012 },
    ],
  }), [lit.plate, lit.edge, lit.shadowPeak]);

  // Two copies of the mark, crossing over: an SVG stroke is not a style, so it
  // cannot ride `interpolateColor` the way the plate and label do.
  const litIcon = useAnimatedStyle(() => ({ opacity: progress.value }));
  const restIcon = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [REST_INK, lit.ink]),
  }), [lit.ink]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      onPressIn={() => { press.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { press.value = withTiming(0, { duration: 190 }); }}
      style={s.modeTouch}
    >
      <Reanimated.View style={[s.modeButton, plateStyle, { shadowColor: lit.shadow }]}>
        <View style={s.modeIcon}>
          <Reanimated.View style={restIcon}>
            <Icon s={ICON} c={REST_INK} w={2} />
          </Reanimated.View>
          <Reanimated.View style={[s.modeIconLit, litIcon]}>
            <Icon s={ICON} c={lit.ink} w={2} />
          </Reanimated.View>
        </View>
        <Reanimated.Text style={[s.modeText, labelStyle]}>{label}</Reanimated.Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────────────────────────
 * HOW LONG BEFORE — the double setting's second question.
 *
 * It was five loose chips, each its own white-to-solid plate. Five
 * plates for one answer reads as five switches, and nothing on the
 * row said the five belonged together or that exactly one of them
 * was ever true.
 *
 * So it is now ONE TRACK with a single lozenge sliding under the
 * chosen minute. The lozenge is the only coloured thing, it is
 * always exactly one, and it travels — which is the plainest way a
 * control can say "this, of these". The numbers only change ink.
 *
 * ⚠ The lozenge is placed off the MEASURED track, not off a guessed
 * width: the sheets this sits in are not all the same width, and a
 * hard-coded segment would drift on any of them. It stays hidden
 * until the first layout, so it never flashes at x=0.
 * ───────────────────────────────────────────────────────────── */

const TRACK_PAD = 3;

function ReminderTrack({
  accent,
  reminderMinutes,
  onReminderChange,
}: {
  accent: string;
  reminderMinutes: number;
  onReminderChange: (minutes: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, REMINDER_OPTIONS.indexOf(reminderMinutes));
  const segment = trackWidth > 0 ? (trackWidth - TRACK_PAD * 2) / REMINDER_OPTIONS.length : 0;

  const x = useSharedValue(0);
  const ready = useSharedValue(0);

  useEffect(() => {
    if (segment <= 0) return;
    const target = TRACK_PAD + index * segment;
    if (ready.value === 0) {
      // First measure: land it, do not fly it in from the left.
      x.value = target;
      ready.value = withTiming(1, { duration: 140 });
      return;
    }
    x.value = reduceMotion
      ? target
      : withSpring(target, { damping: 20, stiffness: 210, mass: 0.7 });
  }, [index, segment, reduceMotion, x, ready]);

  const lozengeStyle = useAnimatedStyle(() => ({
    width: segment,
    opacity: ready.value,
    transform: [{ translateX: x.value }],
  }), [segment]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth(prev => (Math.abs(prev - w) < 0.5 ? prev : w));
  };

  return (
    <Reanimated.View entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(140)} style={s.reminderWrap}>
      <Text style={s.reminderCaption}>Remind before</Text>

      <View style={[s.track, { borderColor: withAlpha(accent, 0.22) }]} onLayout={onLayout}>
        <Reanimated.View
          pointerEvents="none"
          style={[s.lozenge, { backgroundColor: accent, shadowColor: accent }, lozengeStyle]}
        />
        {REMINDER_OPTIONS.map(minutes => (
          <ReminderSegment
            key={minutes}
            minutes={minutes}
            active={reminderMinutes === minutes}
            onPress={() => onReminderChange(minutes)}
          />
        ))}
      </View>
    </Reanimated.View>
  );
}

function ReminderSegment({
  minutes,
  active,
  onPress,
}: {
  minutes: number;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  // Only the ink moves. The plate under it is the one travelling lozenge.
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], ['#9A958C', '#FFFFFF']),
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={s.segment}>
      <Reanimated.Text style={[s.segmentText, textStyle]}>{minutes}m</Reanimated.Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 11,
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.7,
    color: C.gold,
    textTransform: 'uppercase',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeTouch: {
    flex: 1,
  },
  modeButton: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: REST_EDGE,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 6,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  modeIcon: { width: ICON, height: ICON, alignItems: 'center', justifyContent: 'center' },
  modeIconLit: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  modeText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },

  reminderWrap: { gap: 8 },
  reminderCaption: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  track: {
    position: 'relative',
    flexDirection: 'row',
    padding: TRACK_PAD,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: '#FBFAF7',
  },
  lozenge: {
    position: 'absolute',
    left: 0,
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 2,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
});
