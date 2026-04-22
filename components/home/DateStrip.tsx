import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '@/constants/tokens';

type DayItem = {
  d: string;
  n: number;
  selected?: boolean;
  sunday?: boolean;
  feast?: boolean;
};

const DAYS: DayItem[] = [
  { d: 'Fri', n: 17 },
  { d: 'Sat', n: 18 },
  { d: 'Sun', n: 19, sunday: true },
  { d: 'Mon', n: 20, selected: true },
  { d: 'Tue', n: 21 },
  { d: 'Wed', n: 22 },
  { d: 'Thu', n: 23, feast: true },
];

export default function DateStrip() {
  return (
    <View style={s.row}>
      {DAYS.map((day, i) => {
        const sel = !!day.selected;
        const accent = day.sunday || day.feast;
        const numC = sel ? '#fff' : accent ? C.red : C.text;
        const dowC = sel ? 'rgba(255,255,255,0.88)' : C.textMuted;

        if (sel) {
          return (
            <LinearGradient
              key={i}
              colors={['#D4B06A', '#B88C45']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={[s.day, s.daySelected]}
            >
              <Text style={[s.dow, { color: dowC }]}>{day.d}</Text>
              <Text style={[s.num, s.numSelected, { color: numC }]}>{day.n}</Text>
            </LinearGradient>
          );
        }

        return (
          <View key={i} style={s.day}>
            <Text style={[s.dow, { color: dowC }]}>{day.d}</Text>
            <Text style={[s.num, { color: numC }]}>{day.n}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 3,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    borderRadius: 18,
  },
  daySelected: {
    shadowColor: '#B88C45',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 6,
  },
  dow: {
    fontFamily: F.serifMediumItalic,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  num: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  numSelected: {
    fontSize: 22,
    fontWeight: '600',
  },
});
