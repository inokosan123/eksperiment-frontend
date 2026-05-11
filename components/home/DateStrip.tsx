import React, { useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C, F } from '@/constants/tokens';

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildMonthDays(selectedKey: string) {
  const [year, month] = selectedKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month - 1, index + 1, 12, 0, 0, 0);
    const dow = date.toLocaleDateString('en-US', { weekday: 'short' });
    const key = toDateKey(date);

    return {
      key,
      dow,
      date: date.getDate(),
      sunday: date.getDay() === 0,
      feast: date.getDay() === 4,
    };
  });
}

export default function DateStrip({
  selectedKey,
  todayKey,
  onSelect,
}: {
  selectedKey: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
}) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const days = useMemo(() => buildMonthDays(selectedKey), [selectedKey]);

  useEffect(() => {
    const cellWidth = 46;
    const gap = 5;
    const horizontalPadding = 16;
    const itemWidth = cellWidth + gap;
    const selectedIndex = days.findIndex(day => day.key === selectedKey);
    if (selectedIndex < 0) return;
    const cellLeft = horizontalPadding + selectedIndex * itemWidth;
    const cellCenter = cellLeft + cellWidth / 2;
    const targetOffset = cellCenter - width / 2;
    const contentWidth = horizontalPadding * 2 + days.length * itemWidth - gap;
    const maxOffset = Math.max(0, contentWidth - width);
    const centeredOffset = Math.max(0, Math.min(maxOffset, targetOffset));
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: centeredOffset, animated: true });
    });
  }, [days, selectedKey, width]);

  return (
    <View style={s.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        decelerationRate="normal"
      >
        {days.map(day => (
          <DateCell
            key={day.key}
            day={day}
            selected={day.key === selectedKey}
            isToday={day.key === todayKey}
            onPress={() => onSelect(day.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function DateCell({
  day,
  selected,
  isToday,
  onPress,
}: {
  day: ReturnType<typeof buildMonthDays>[number];
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const todayProgress = useSharedValue(isToday && !selected ? 1 : 0);
  const numIdleColor = C.text;
  const dowIdleColor = isToday ? C.gold : C.textMuted;

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, {
      damping: 18,
      stiffness: 230,
      mass: 0.75,
    });
  }, [progress, selected]);

  useEffect(() => {
    todayProgress.value = withTiming(isToday && !selected ? 1 : 0, { duration: 140 });
  }, [isToday, selected, todayProgress]);

  const shellStyle = useAnimatedStyle(() => ({}));

  const selectedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const todayStyle = useAnimatedStyle(() => ({
    opacity: todayProgress.value,
  }));

  const dowStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [dowIdleColor, 'rgba(255,255,255,0.92)']
    ),
  }));

  const numStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [numIdleColor, '#FFFFFF']),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: todayProgress.value,
    transform: [{ scale: todayProgress.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={s.dayPress}
    >
      <Reanimated.View style={[s.day, s.dayMotion, shellStyle]}>
        <Reanimated.View pointerEvents="none" style={[s.todayFill, todayStyle]} />
        <Reanimated.View pointerEvents="none" style={[s.selectedFillWrap, selectedStyle]}>
          <LinearGradient
            colors={['#E2BD75', '#C5A059', '#A87E33']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={s.selectedFill}
          />
          <View style={s.selectedSheen} pointerEvents="none" />
          <View style={s.selectedRim} pointerEvents="none" />
        </Reanimated.View>
        <Reanimated.Text style={[s.dow, dowStyle]}>{day.dow}</Reanimated.Text>
        <Reanimated.Text style={[s.num, numStyle]}>{day.date}</Reanimated.Text>
        {isToday && <Reanimated.View style={[s.todayUnderline, dotStyle]} />}
      </Reanimated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 16,
    gap: 5,
  },
  dayPress: {
    borderRadius: 20,
  },
  day: {
    position: 'relative',
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 9,
    borderRadius: 16,
  },
  dayMotion: {},
  todayFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  selectedFillWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectedFill: {
    flex: 1,
    borderRadius: 16,
  },
  selectedSheen: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '42%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  selectedRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(150,108,40,0.30)',
  },
  todayUnderline: {
    position: 'absolute',
    bottom: 5,
    width: 14,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: C.gold,
  },
  dow: {
    fontFamily: F.serifMediumItalic,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  num: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    marginTop: 2,
    lineHeight: 20,
  },
});
