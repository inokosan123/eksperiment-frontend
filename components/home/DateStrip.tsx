import React, { useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    const itemWidth = 56;
    const selectedIndex = days.findIndex(day => day.key === selectedKey);
    if (selectedIndex < 0) return;
    const centeredOffset = Math.max(0, 16 + selectedIndex * itemWidth - (width - 52) / 2);
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
        decelerationRate="fast"
      >
        {days.map(day => {
          const selected = day.key === selectedKey;
          const isToday = day.key === todayKey;
          const accent = day.sunday || day.feast;
          const numColor = selected ? '#FFFFFF' : accent ? C.red : C.text;
          const dowColor = selected
            ? 'rgba(255,255,255,0.92)'
            : isToday
              ? C.gold
              : accent ? '#B7AEA1' : C.textMuted;

          if (selected) {
            return (
              <TouchableOpacity
                key={day.key}
                activeOpacity={0.9}
                onPress={() => onSelect(day.key)}
              >
                <LinearGradient
                  colors={['#D5B06A', '#B98B42']}
                  start={{ x: 0.18, y: 0 }}
                  end={{ x: 0.82, y: 1 }}
                  style={[s.day, s.daySelected]}
                >
                  <Text style={[s.dow, { color: dowColor }]}>{day.dow}</Text>
                  <Text style={[s.num, s.numSelected, { color: numColor }]}>{day.date}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={day.key}
              activeOpacity={0.82}
              onPress={() => onSelect(day.key)}
              style={s.dayPress}
            >
              <View style={[s.day, isToday && s.todayDay]}>
                <Text style={[s.dow, { color: dowColor }]}>{day.dow}</Text>
                <Text style={[s.num, { color: numColor }]}>{day.date}</Text>
                {isToday && <View style={s.todayDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop: 6,
    paddingBottom: 2,
  },
  row: {
    paddingHorizontal: 16,
    gap: 4,
  },
  dayPress: {
    borderRadius: 20,
  },
  day: {
    position: 'relative',
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    borderRadius: 18,
  },
  todayDay: {
    backgroundColor: 'rgba(197,160,89,0.08)',
  },
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.gold,
  },
  daySelected: {
    width: 52,
    shadowColor: '#B88C45',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 7,
  },
  dow: {
    fontFamily: F.serifMediumItalic,
    fontSize: 11,
    letterSpacing: 0.15,
  },
  num: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    marginTop: 4,
    lineHeight: 22,
  },
  numSelected: {
    fontSize: 22,
    lineHeight: 24,
  },
});
