import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { AlertTriangle } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { FocusCeremonialHead, FocusSheetHandle } from './FocusSheetHeader';
import AllowanceDial from './AllowanceDial';
import GoldButton from './GoldButton';
import { formatMinutesShort } from './dayPlanStore';
import {
  FOCUS_LIMIT_PICKER_MAX_MINUTES,
  FOCUS_LIMIT_STEP_MINUTES,
} from './focusLimitBudget';

const ITEM_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const WHEEL_PADDING = ITEM_HEIGHT * 2;
// C.bg with the alpha taken out, for the ends of the wheel's fades.
const SHEET_GROUND_CLEAR = 'rgba(252,252,252,0)';

function clampPickerValue(value: number) {
  const snapped = Math.round(value / FOCUS_LIMIT_STEP_MINUTES) * FOCUS_LIMIT_STEP_MINUTES;
  return Math.max(
    FOCUS_LIMIT_STEP_MINUTES,
    Math.min(FOCUS_LIMIT_PICKER_MAX_MINUTES, snapped)
  );
}

function pickerSeed(
  value: number | null,
  minimumMinutes: number,
  maximumMinutes: number,
  defaultMinutes: number
) {
  const desired = clampPickerValue(value ?? defaultMinutes);
  if (maximumMinutes < FOCUS_LIMIT_STEP_MINUTES) return desired;
  const lower = Math.max(
    FOCUS_LIMIT_STEP_MINUTES,
    Math.ceil(minimumMinutes / FOCUS_LIMIT_STEP_MINUTES) * FOCUS_LIMIT_STEP_MINUTES
  );
  const upper = Math.max(
    FOCUS_LIMIT_STEP_MINUTES,
    Math.floor(maximumMinutes / FOCUS_LIMIT_STEP_MINUTES) * FOCUS_LIMIT_STEP_MINUTES
  );
  return Math.max(lower, Math.min(upper, desired));
}

function DurationWheel({
  value,
  accent,
  minimumMinutes,
  maximumMinutes,
  onChange,
}: {
  value: number;
  accent: string;
  minimumMinutes: number;
  maximumMinutes: number;
  onChange: (next: number) => void;
}) {
  const options = useMemo(
    () => Array.from(
      { length: FOCUS_LIMIT_PICKER_MAX_MINUTES / FOCUS_LIMIT_STEP_MINUTES },
      (_, index) => (index + 1) * FOCUS_LIMIT_STEP_MINUTES
    ),
    []
  );
  const scrollRef = useRef<Animated.ScrollView>(null);
  const selectedIndex = Math.max(0, options.indexOf(clampPickerValue(value)));
  const lastIndexRef = useRef(selectedIndex);

  const publish = useCallback((index: number) => {
    const bounded = Math.max(0, Math.min(options.length - 1, index));
    if (lastIndexRef.current === bounded) return;
    lastIndexRef.current = bounded;
    void Haptics.selectionAsync().catch(() => {});
    onChange(options[bounded]);
  }, [onChange, options]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    });
    return () => cancelAnimationFrame(frame);
    // The wheel remounts whenever the embedded sheet opens. Later movement
    // belongs to the native scroll view and must not be chased from JS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      const index = Math.round(event.contentOffset.y / ITEM_HEIGHT);
      runOnJS(publish)(index);
    },
  });

  return (
    <View style={s.wheelCard}>
      {/* The band is ruled in the room's own colour and open at the sides, so
          it reads as the instrument's index line rather than as a grey slab
          sitting behind the number. */}
      <View style={[s.selectionBand, { borderColor: `${accent}3D` }]} pointerEvents="none" />
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={s.wheelContent}
      >
        {options.map(option => {
          const selected = option === value;
          const unavailable = option < minimumMinutes || option > maximumMinutes;
          return (
            <View key={option} style={s.wheelItem}>
              <Text
                style={[
                  s.wheelItemText,
                  unavailable && s.wheelItemTextUnavailable,
                  selected && !unavailable && [s.wheelItemTextSelected, { color: accent }],
                  selected && unavailable && s.wheelItemTextSelectedUnavailable,
                ]}
                numberOfLines={1}
              >
                {formatMinutesShort(option)}
              </Text>
            </View>
          );
        })}
      </Animated.ScrollView>
      {/* The wheel now stands on the sheet's own ground rather than in a card,
          so the fades must end in exactly that ground — they used to fade to a
          different near-white, which tinted the ends of the scale. */}
      <LinearGradient
        colors={[C.bg, SHEET_GROUND_CLEAR]}
        style={s.fadeTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[SHEET_GROUND_CLEAR, C.bg]}
        style={s.fadeBottom}
        pointerEvents="none"
      />
    </View>
  );
}

export default function LimitDurationWheelSheet({
  visible,
  title,
  value,
  defaultMinutes = 45,
  minimumMinutes,
  maximumMinutes,
  parentLabel,
  parentMinutes,
  allocatedElsewhereMinutes,
  lowerBoundReason,
  upperBoundReason,
  accent,
  embedded = false,
  onClose,
  onSave,
  onSaveNoLimit,
}: {
  visible: boolean;
  title: string;
  value: number | null;
  defaultMinutes?: number;
  minimumMinutes: number;
  maximumMinutes: number;
  parentLabel: string;
  parentMinutes: number | null;
  allocatedElsewhereMinutes: number;
  lowerBoundReason: string;
  upperBoundReason: string;
  accent: string;
  embedded?: boolean;
  onClose: () => void;
  onSave: (nextMinutes: number) => void;
  onSaveNoLimit: () => void;
}) {
  const [candidate, setCandidate] = useState(
    pickerSeed(value, minimumMinutes, maximumMinutes, defaultMinutes)
  );

  useEffect(() => {
    if (visible) {
      setCandidate(pickerSeed(value, minimumMinutes, maximumMinutes, defaultMinutes));
    }
  }, [defaultMinutes, maximumMinutes, minimumMinutes, value, visible]);

  const belowMinimum = candidate < minimumMinutes;
  const aboveMaximum = candidate > maximumMinutes;
  const valid = !belowMinimum && !aboveMaximum;
  const unavailableReason = belowMinimum
    ? lowerBoundReason
    : aboveMaximum
      ? upperBoundReason
      : null;
  const remaining = parentMinutes == null
    ? null
    : Math.max(0, parentMinutes - allocatedElsewhereMinutes - candidate);
  const available = parentMinutes == null
    ? FOCUS_LIMIT_PICKER_MAX_MINUTES
    : Math.max(0, parentMinutes - allocatedElsewhereMinutes);
  // The arc reads against the whole this allowance is taken out of. With no
  // parent there is no whole, so it reads against the picker's own ceiling and
  // simply shows how large a number has been asked for.
  const dialFraction = parentMinutes == null
    ? candidate / FOCUS_LIMIT_PICKER_MAX_MINUTES
    : candidate / parentMinutes;
  // The head names what is being set, so the title can stay "Time limit" for
  // every one of them and the room is named beneath it.
  const subject = `for ${title}`;

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      embedded={embedded}
      backdropOpacity={0.28}
      sheetStyle={s.sheet}
    >
      <FocusSheetHandle />
      <FocusCeremonialHead
        title="Time limit"
        meta={subject}
        accent={accent}
        onClose={onClose}
      />

      {/* THE INSTRUMENT AND ITS DIAL.

          This sheet used to state the candidate four times over: in an "AFTER"
          chip, in a display number, in the wheel's own selection band, and by
          implication in the summary band beside it. The dial is the preview
          now — it is the same instrument the rule's plate wears, so setting a
          limit and reading it back are one object at two scales — and the
          summary band and the display number are both gone.

          The dial reads against the whole it belongs to (the Daily Target, or
          the group's allowance when an app is being set), which is the only
          relationship the number needs to show. */}
      <View style={s.instrument}>
        <AllowanceDial
          size={150}
          strokeWidth={7}
          fraction={dialFraction}
          accent={valid ? accent : '#9B4351'}
        >
          <View style={s.dialCopy}>
            <Text style={[s.dialValue, { color: valid ? accent : '#9B4351' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatMinutesShort(candidate)}
            </Text>
            <Text style={s.dialCaption}>a day</Text>
          </View>
        </AllowanceDial>

        <DurationWheel
          value={candidate}
          accent={accent}
          minimumMinutes={minimumMinutes}
          maximumMinutes={maximumMinutes}
          onChange={setCandidate}
        />
      </View>

      {unavailableReason ? (
        <Animated.View style={s.notice}>
          <AlertTriangle s={15} c="#9B5D25" w={2.2} />
          <Text style={s.noticeText}>{unavailableReason}</Text>
        </Animated.View>
      ) : (
        <View style={s.validNote}>
          <View style={[s.validDot, { backgroundColor: accent }]} />
          {/* A number, where there used to be a reassurance. */}
          <Text style={s.validText}>
            {remaining == null
              ? `Up to ${formatMinutesShort(available)} can be given here`
              : `${formatMinutesShort(remaining)} left of your ${parentLabel}`}
          </Text>
        </View>
      )}

      <GoldButton
        label="Use this limit"
        disabled={!valid}
        onPress={() => {
          if (!valid) return;
          onSave(candidate);
          onClose();
        }}
        style={s.saveButton}
      />
      <TouchableOpacity
        style={s.noLimitButton}
        onPress={() => {
          onSaveNoLimit();
          onClose();
        }}
        haptic="selection"
        activeOpacity={0.76}
        accessibilityRole="button"
      >
        <Text style={s.noLimitButtonText}>
          No limit
        </Text>
      </TouchableOpacity>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  // The dial and the wheel that feeds it, side by side: one is what you are
  // choosing, the other is the choosing.
  instrument: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  dialCopy: { alignItems: 'center', paddingHorizontal: 18 },
  dialValue: {
    fontFamily: F.serifBold,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  dialCaption: { marginTop: 3, fontFamily: F.serif, fontSize: 13, lineHeight: 16, color: C.textMuted },
  // No card around the wheel any more — it stands beside the dial as the
  // instrument's own scale, and a bordered plate there would have made two
  // objects out of one.
  wheelCard: {
    position: 'relative',
    width: 116,
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    overflow: 'hidden',
  },
  wheelContent: { paddingVertical: WHEEL_PADDING },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 23,
    color: '#B5AFA5',
    fontVariant: ['tabular-nums'],
  },
  wheelItemTextUnavailable: {
    color: '#DAD6CE',
  },
  wheelItemTextSelected: {
    fontFamily: F.serifBold,
    fontSize: 22,
  },
  wheelItemTextSelectedUnavailable: {
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    color: '#A45A66',
  },
  // Two index lines, not a filled slab: the reading is between them.
  selectionBand: {
    position: 'absolute',
    zIndex: 1,
    left: 0,
    right: 0,
    top: WHEEL_PADDING,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  fadeTop: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.35,
  },
  fadeBottom: {
    position: 'absolute',
    zIndex: 2,
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.35,
  },
  notice: {
    marginTop: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E9D4B4',
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#855021',
  },
  validNote: {
    minHeight: 48,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  validDot: { width: 6, height: 6, borderRadius: 3 },
  validText: {
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: C.textSecondary,
  },
  saveButton: { marginTop: 4 },
  noLimitButton: {
    alignSelf: 'center',
    marginTop: 13,
    minHeight: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noLimitButtonText: {
    fontFamily: F.serifSemiBold,
    fontSize: 15,
    color: C.textSecondary,
    textDecorationLine: 'underline',
    textDecorationColor: '#C7B68F',
  },
});
