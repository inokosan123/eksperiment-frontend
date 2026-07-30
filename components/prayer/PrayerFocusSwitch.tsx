import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Reanimated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { MINE_INK } from '@/components/prayer/myRuleTone';

/* ─────────────────────────────────────────────────────────────
 * CROSS or JESUS — what stands in front of you while you pray.
 *
 * WHY THE CHOICE EXISTS. My Rule is written for Christians of every
 * tradition, and a Byzantine icon is not a neutral object: for some it
 * is the natural thing to pray before, and for others praying in front
 * of an image is precisely what they do not do. Putting the icon on the
 * screen and calling it universal would contradict the sentence this
 * whole feature is built on.
 *
 * ⚠ NEITHER SIDE IS THE LESSER ONE, AND THE NAMES CARRY THAT. They are
 * two things — CROSS and JESUS — not a plain option and a rich one.
 * Nothing here says "simple", "basic" or "no image", because every one
 * of those describes the cross by what it lacks. The cross is the ground
 * every tradition shares and it is the default; the icon is an offer.
 *
 * ⚠ AND THE SECOND NAME IS JESUS, NOT "ICON". "Icon" names the medium —
 * a painted board — which is exactly the word that would give a
 * Protestant reader pause, and it describes the object rather than who
 * is on it. Both sides of this switch are Christ; one is His cross and
 * one is His face. Naming Him says that, and it stops the choice
 * reading as a choice between traditions.
 *
 * ⚠ THIS IS NOT THE APP'S TWO-KINDS PLAQUE, AND THAT IS DELIBERATE.
 * Set as Task and the Prayer Book switch are struck as recessed tracks
 * with a raised sliding plaque, and that grammar is right where a
 * control sits among other controls. This one stands directly above the
 * object on warm paper, on the quietest screen in the app, and a
 * shadowed plaque there is furniture in a room that should hold one
 * thing. So it is set as a BOOK sets a choice: two names in the serif,
 * and a fine gilt rule travelling under the one that is chosen.
 *
 * The rule fades to nothing at both ends — the app's engraving idiom,
 * light caught along a line rather than ink drawn on top of one — and it
 * carries the chosen side's own colour, so the switch changes
 * temperature with the choice exactly as the objects below it do.
 * ───────────────────────────────────────────────────────────── */

export type PrayerFocus = 'cross' | 'icon';

/** The app's one selection spring, the same figures as every other choice. */
const SELECT_SPRING = { damping: 18, stiffness: 235, mass: 0.72 };

const REST_INK = '#A8A29E';
const JESUS_INK = C.goldDark;
const CROSS_RULE = '#5B7FA6';

/**
 * The air either side of each name.
 *
 * ⚠ It is a constant rather than a style-sheet number because the rule's
 * geometry is derived from it: `onLayout` reports each name's TAP AREA,
 * padding included, and the rule has to be as wide as the WORD. Nested
 * layouts do not compose their offsets, so the padding is subtracted
 * here instead of measured a second level down. Change one and the other
 * changes with it.
 */
const CHOICE_PAD = 18;

type Slot = { x: number; width: number };

export default function PrayerFocusSwitch({
  value,
  onChange,
}: {
  value: PrayerFocus;
  onChange: (focus: PrayerFocus) => void;
}) {
  const reduceMotion = useReducedMotion();
  const icon = value === 'icon';
  const motion = useSharedValue(icon ? 1 : 0);
  // The rule is as wide as the word it underlines, so both are measured.
  // A constant would be wrong in the first language that is not English.
  const [slots, setSlots] = useState<[Slot, Slot]>([
    { x: 0, width: 0 },
    { x: 0, width: 0 },
  ]);

  useEffect(() => {
    const target = icon ? 1 : 0;
    motion.value = reduceMotion ? target : withSpring(target, SELECT_SPRING);
  }, [motion, icon, reduceMotion]);

  const onSlotLayout = useCallback((index: 0 | 1) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setSlots(current => {
      const slot = current[index];
      if (Math.abs(slot.x - x) < 0.5 && Math.abs(slot.width - width) < 0.5) return current;
      const next: [Slot, Slot] = [current[0], current[1]];
      next[index] = { x, width };
      return next;
    });
  }, []);

  const ready = slots[0].width > 0 && slots[1].width > 0;

  // ⚠ Resolved on the JS side and handed to the worklet as plain numbers.
  // A helper called from inside `useAnimatedStyle` would be a JS closure
  // invoked on the UI thread, which is exactly the thing that is not
  // allowed to happen there.
  const ends = useMemo(() => ({
    fromX: slots[0].x + CHOICE_PAD,
    fromW: Math.max(0, slots[0].width - CHOICE_PAD * 2),
    toX: slots[1].x + CHOICE_PAD,
    toW: Math.max(0, slots[1].width - CHOICE_PAD * 2),
  }), [slots]);

  const ruleStyle = useAnimatedStyle(() => ({
    width: interpolate(motion.value, [0, 1], [ends.fromW, ends.toW]),
    transform: [{ translateX: interpolate(motion.value, [0, 1], [ends.fromX, ends.toX]) }],
  }), [ends]);

  const crossRuleStyle = useAnimatedStyle(() => ({ opacity: 1 - motion.value }));
  const jesusRuleStyle = useAnimatedStyle(() => ({ opacity: motion.value }));

  const crossInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [MINE_INK, REST_INK]),
  }));
  const jesusInkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(motion.value, [0, 1], [REST_INK, JESUS_INK]),
  }));

  return (
    <View style={s.wrap} accessibilityRole="radiogroup">
      {/* ⚠ The rule lives INSIDE the row, not under it. The slots are
          measured against the row, so putting the rule anywhere else
          would leave the two in different coordinate systems and the
          underline sitting beside the word it belongs to. In here it
          cannot drift by construction. */}
      <View style={s.row}>
        <TouchableOpacity
          onPress={() => onChange('cross')}
          onLayout={onSlotLayout(0)}
          activeOpacity={0.7}
          haptic="selection"
          style={s.choice}
          accessibilityRole="radio"
          accessibilityState={{ checked: !icon }}
          accessibilityLabel="Cross. Pray in front of a plain cross."
        >
          <Reanimated.Text style={[s.name, crossInkStyle]}>Cross</Reanimated.Text>
        </TouchableOpacity>

        {/* The prayer book's own struck diamond, holding the two names
            apart. Not a divider rule: a rule here would be a second line
            arguing with the one that travels below. */}
        <View style={s.pip} />

        <TouchableOpacity
          onPress={() => onChange('icon')}
          onLayout={onSlotLayout(1)}
          activeOpacity={0.7}
          haptic="selection"
          style={s.choice}
          accessibilityRole="radio"
          accessibilityState={{ checked: icon }}
          accessibilityLabel="Jesus. Pray in front of the sixth-century icon of Christ."
        >
          <Reanimated.Text style={[s.name, jesusInkStyle]}>Jesus</Reanimated.Text>
        </TouchableOpacity>

        {/* The travelling rule, drawn twice and cross-faded: a gradient's
            stops cannot be animated, so the gilt one and the dove one
            exchange on the same value that moves them. */}
        {ready && (
          <Reanimated.View pointerEvents="none" style={[s.rule, ruleStyle]}>
            <Reanimated.View style={[StyleSheet.absoluteFill, crossRuleStyle]}>
              <FadingRule tint={CROSS_RULE} />
            </Reanimated.View>
            <Reanimated.View style={[StyleSheet.absoluteFill, jesusRuleStyle]}>
              <FadingRule tint={C.gold} />
            </Reanimated.View>
          </Reanimated.View>
        )}
      </View>
    </View>
  );
}

/**
 * A hairline that is brightest at its middle and gone at both ends.
 *
 * A rule of even weight stops dead where it stops, and reads as ink laid
 * on the page; this one reads as light caught along an engraved line,
 * which is how every divider in the app's liturgical register is drawn.
 */
function FadingRule({ tint }: { tint: string }) {
  return (
    <LinearGradient
      colors={['transparent', tint, tint, 'transparent']}
      locations={[0, 0.28, 0.72, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // `relative` is what the rule inside it is positioned against, and the
  // padding is the room it stands in.
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 7,
  },
  // Generous either side: the two names are the whole control, and the
  // taps have to be comfortable without a plate to make them look large.
  choice: { paddingHorizontal: CHOICE_PAD, paddingVertical: 7 },
  name: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: 0.1,
  },
  pip: {
    width: 4.5,
    height: 4.5,
    borderRadius: 0.8,
    opacity: 0.42,
    backgroundColor: C.gold,
    transform: [{ rotate: '45deg' }],
  },
  // Absolute, so it can never take part in the row's layout and nudge the
  // names as it travels.
  rule: { position: 'absolute', bottom: 2, height: 1.5, borderRadius: 1 },
});
