import { useEffect, useMemo, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { C, F } from '@/constants/tokens';

const ITEM_HEIGHT = 42;
const VISIBLE_ROWS = 3;
const PADDING = ITEM_HEIGHT * ((VISIBLE_ROWS - 1) / 2);

function durationText(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours}h ${rest}m`;
}

// One calm wheel for choosing a duration: spin once, read the serif value in
// the gold band, done. Replaces plus/minus steppers entirely.
export default function DurationWheel({
  options,
  value,
  onChange,
  surface = '#FFF9EB',
}: {
  options: number[];
  value: number;
  onChange: (nextMinutes: number) => void;
  surface?: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(Math.max(0, options.indexOf(value)));
  const optionsKey = useMemo(() => options.join(','), [options]);

  useEffect(() => {
    const index = Math.max(0, options.indexOf(value));
    lastIndexRef.current = index;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(timer);
    // Re-seed only when the option set itself changes (e.g. extend mode).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  const indexAt = (offsetY: number) =>
    Math.max(0, Math.min(options.length - 1, Math.round(offsetY / ITEM_HEIGHT)));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = indexAt(event.nativeEvent.contentOffset.y);
    if (index !== lastIndexRef.current) {
      lastIndexRef.current = index;
      void Haptics.selectionAsync().catch(() => {});
      onChange(options[index]);
    }
  };

  const settle = (offsetY: number) => {
    const index = indexAt(offsetY);
    lastIndexRef.current = index;
    onChange(options[index]);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={s.card}>
      <View style={s.band} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        nestedScrollEnabled
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={event => settle(event.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingVertical: PADDING }}
      >
        {options.map(option => {
          const active = option === value;
          return (
            <View key={option} style={s.item}>
              <Text style={[s.itemText, active && s.itemTextActive]}>{durationText(option)}</Text>
            </View>
          );
        })}
      </ScrollView>
      <LinearGradient
        colors={[surface, `${surface}00`]}
        style={s.fadeTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`${surface}00`, surface]}
        style={s.fadeBottom}
        pointerEvents="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: PADDING,
    height: ITEM_HEIGHT,
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EAD9B7',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: F.sansMedium,
    fontSize: 15,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  itemTextActive: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    color: C.goldDark,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 0.9,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 0.9,
  },
});
