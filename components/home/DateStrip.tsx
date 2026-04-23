import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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

function buildDays() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  return Array.from({ length: 15 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
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

export default function DateStrip() {
  const days = useMemo(() => buildDays(), []);
  const [selectedKey, setSelectedKey] = useState(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return toDateKey(today);
  });

  return (
    <View style={s.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        decelerationRate="fast"
      >
        {days.map(day => {
          const selected = day.key === selectedKey;
          const accent = day.sunday || day.feast;
          const numColor = selected ? '#FFFFFF' : accent ? C.red : C.text;
          const dowColor = selected ? 'rgba(255,255,255,0.92)' : accent ? '#B7AEA1' : C.textMuted;

          if (selected) {
            return (
              <TouchableOpacity
                key={day.key}
                activeOpacity={0.9}
                onPress={() => setSelectedKey(day.key)}
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
              onPress={() => setSelectedKey(day.key)}
              style={s.dayPress}
            >
              <View style={s.day}>
                <Text style={[s.dow, { color: dowColor }]}>{day.dow}</Text>
                <Text style={[s.num, { color: numColor }]}>{day.date}</Text>
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
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    borderRadius: 18,
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
