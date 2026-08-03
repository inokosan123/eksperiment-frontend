import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type View as RNView } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CheckSmall, ChevronDown } from '@/components/icons/Icons';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import type { HabitEmojiName } from '@/components/shared/notoEmoji/habits';
import { F } from '@/constants/tokens';

// The one emoji picker.
//
// Big Events, Habits and a plan's custom groups all ask the same question —
// "which face does this wear?" — and each had grown its own answer: two
// near-identical chip styles, two grids, two show-more behaviours, kept in step
// by hand. Improving one improved one. This is that element, once, so a change
// here lands on all three.
//
// The construction is Big Events' — the most developed of them — carried over
// whole rather than simplified: a grid that measures its own width for the
// column count, an animated reveal of the hidden rows, the deferred warm-up
// that keeps a sheet from stalling as it opens, and the accessibility hiding
// that keeps collapsed chips out of the screen reader's path. What the caller
// supplies is the ACCENT, so a gold register and a coloured one each look like
// themselves.

const CHIP = 54;
const GAP = 9;
const GOLD = '#C5A059';

export type EmojiName = HabitEmojiName;

function EmojiChip({
  icon,
  active,
  accent,
  tint,
  onSelect,
}: {
  icon: EmojiName;
  active: boolean;
  accent: string;
  tint: string;
  onSelect: () => void;
}) {
  return (
    <View style={s.cell}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onSelect();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          s.chip,
          active && [s.chipActive, { borderColor: accent, backgroundColor: tint, shadowColor: accent }],
          pressed && s.pressed,
        ]}
      >
        <View style={s.glyphBox}>
          <NotoEmoji name={icon} size={32} />
        </View>
        {active && (
          <View pointerEvents="none" style={[s.badge, { backgroundColor: accent }]}>
            <CheckSmall s={12} c="#FFFFFF" w={3} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

function RevealChevron({ expanded }: { expanded: boolean }) {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 190,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <View style={s.chevronShell}>
      <Animated.View style={style}>
        <ChevronDown s={16} c="#786C5E" w={2.2} />
      </Animated.View>
    </View>
  );
}

export type EmojiPickerProps = {
  value: EmojiName;
  icons: readonly EmojiName[];
  onChange: (next: EmojiName) => void;
  /** The chosen chip's colour. Defaults to the app's gold. */
  accent?: string;
  /** The chosen chip's ground. Defaults to the gold register's pale field. */
  tint?: string;
  collapsedRows?: number;
  /**
   * Inside a sheet, the hidden set is rendered only after the sheet has begun
   * moving — drawing every emoji during the opening tap holds the JS thread
   * long enough to show as a pause. Outside one, it renders straight away.
   */
  deferExtras?: boolean;
  /** Word for what is being chosen, e.g. "event" — used in the reveal's label. */
  noun?: string;
  onGridLayout?: (event: LayoutChangeEvent) => void;
};

// The ref lands on the visible grid, so a guided tour can spotlight it.
const EmojiPicker = forwardRef<RNView, EmojiPickerProps>(function EmojiPicker({
  value,
  icons,
  onChange,
  accent = GOLD,
  tint = '#FFF4D6',
  collapsedRows = 5,
  deferExtras = false,
  noun = 'icons',
  onGridLayout,
}, ref) {
  const [gridWidth, setGridWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [extrasReady, setExtrasReady] = useState(!deferExtras);
  const initialised = useRef(false);
  const reveal = useSharedValue(0);
  const extraHeight = useSharedValue(0);

  // The column count is measured rather than assumed: the same picker sits in a
  // full-screen form and in a narrow sheet, and a fixed count would either
  // overflow the narrow one or leave a gap in the wide one.
  const columns = gridWidth > 0
    ? Math.max(3, Math.floor((gridWidth + GAP) / (CHIP + GAP)))
    : 5;
  const collapsedCount = columns * collapsedRows;

  const collapsed = useMemo(() => icons.slice(0, collapsedCount), [collapsedCount, icons]);
  const extra = useMemo(() => icons.slice(collapsedCount), [collapsedCount, icons]);
  const hiddenCount = extra.length;

  const collapsedSpacers = useMemo(
    () => Array.from({ length: (columns - (collapsed.length % columns)) % columns }, (_, i) => i),
    [collapsed.length, columns],
  );
  const extraSpacers = useMemo(
    () => Array.from({ length: (columns - (extra.length % columns)) % columns }, (_, i) => i),
    [columns, extra.length],
  );

  // Opening on a choice that lives in the hidden rows would look like the
  // picker had forgotten it, so the grid opens itself instead.
  useEffect(() => {
    if (!gridWidth || initialised.current) return;
    initialised.current = true;
    if (icons.indexOf(value) >= collapsedCount) setExpanded(true);
  }, [collapsedCount, gridWidth, icons, value]);

  useEffect(() => {
    if (!deferExtras) {
      setExtrasReady(true);
      return undefined;
    }
    const timer = setTimeout(() => setExtrasReady(true), 300);
    return () => clearTimeout(timer);
  }, [deferExtras]);

  useEffect(() => {
    reveal.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? 285 : 220,
      easing: expanded
        ? Easing.bezier(0.22, 1, 0.36, 1)
        : Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [expanded, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    height: extraHeight.value * reveal.value,
    opacity: interpolate(reveal.value, [0, 0.14, 1], [0, 0.34, 1]),
    transform: [{ translateY: interpolate(reveal.value, [0, 1], [-5, 0]) }],
  }));

  const toggle = () => {
    const next = !expanded;
    if (next && !extrasReady) setExtrasReady(true);
    setExpanded(next);
  };

  const chip = (icon: EmojiName) => (
    <EmojiChip
      key={icon}
      icon={icon}
      active={icon === value}
      accent={accent}
      tint={tint}
      onSelect={() => onChange(icon)}
    />
  );

  return (
    <View>
      <View
        ref={ref}
        style={s.grid}
        onLayout={event => {
          setGridWidth(Math.floor(event.nativeEvent.layout.width));
          onGridLayout?.(event);
        }}
      >
        {collapsed.map(chip)}
        {/* `space-between` would stretch a short last row across the width, so
            it is padded out with zero-height spacers. */}
        {collapsedSpacers.map(index => (
          <View key={`spacer-${index}`} pointerEvents="none" style={s.spacer} />
        ))}
      </View>

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
        style={[s.clip, revealStyle]}
      >
        {extrasReady && (
          <View
            style={s.measure}
            onLayout={event => {
              extraHeight.value = Math.ceil(event.nativeEvent.layout.height);
              // If the set warmed up while already open, the reveal is replayed
              // against the height it now knows.
              if (expanded) {
                reveal.value = 0;
                reveal.value = withTiming(1, {
                  duration: 285,
                  easing: Easing.bezier(0.22, 1, 0.36, 1),
                });
              }
            }}
          >
            <View style={s.grid}>
              {extra.map(chip)}
              {extraSpacers.map(index => (
                <View key={`extra-spacer-${index}`} pointerEvents="none" style={s.spacer} />
              ))}
            </View>
          </View>
        )}
      </Animated.View>

      {hiddenCount > 0 && (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={expanded ? `Show fewer ${noun}` : `Show more ${noun}`}
          accessibilityState={{ expanded }}
          style={({ pressed }) => [
            s.more,
            expanded && s.moreExpanded,
            pressed && s.pressed,
          ]}
        >
          <View style={s.moreCopy}>
            <Text style={s.moreTitle}>{expanded ? 'SHOW LESS' : 'SHOW MORE'}</Text>
            <Text style={s.moreMeta}>
              {expanded
                ? `Back to the first ${collapsedRows === 1 ? 'row' : `${collapsedRows} rows`}`
                : `${hiddenCount} more ${noun}`}
            </Text>
          </View>
          <RevealChevron expanded={expanded} />
        </Pressable>
      )}
    </View>
  );
});

export default EmojiPicker;

const s = StyleSheet.create({
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: GAP,
    rowGap: GAP,
  },
  clip: { width: '100%', overflow: 'hidden' },
  measure: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: GAP },
  cell: { width: CHIP, height: CHIP },
  spacer: { width: CHIP, height: 0 },
  pressed: { opacity: 0.78 },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: 19,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#8C7A4F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  chipActive: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 4,
  },
  glyphBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    minHeight: 54,
    marginTop: 12,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7E0D4',
    backgroundColor: '#F8F5EE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  moreExpanded: { borderColor: '#E7D6B1', backgroundColor: '#FFF9EC' },
  moreCopy: { flex: 1, minWidth: 0 },
  moreTitle: { fontFamily: F.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5, color: '#6F6253' },
  moreMeta: { marginTop: 2, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17, color: '#9A9085' },
  chevronShell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5DCCB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
