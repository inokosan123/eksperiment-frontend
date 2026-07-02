import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import { formatTimeOfDay } from './focusWatchStore';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_PADDING = ITEM_HEIGHT * 2;
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

function Wheel({
  options,
  value,
  onChange,
}: {
  options: number[];
  value: number;
  onChange: (next: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const index = Math.max(0, options.indexOf(value));
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(timer);
    // Seed once on mount — later positions come from the user's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (offsetY: number) => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
    onChange(options[index]);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={s.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        onMomentumScrollEnd={event => settle(event.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
      >
        {options.map(option => {
          const active = option === value;
          return (
            <View key={option} style={s.wheelItem}>
              <Text style={[s.wheelItemText, active && s.wheelItemTextActive]}>
                {option < 10 ? `0${option}` : option}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// The Focus tab time picker: a calm wheel sheet in the app's language —
// serif preview, gold selection band, Save on a gold pill.
export default function TimeWheelSheet({
  visible,
  title,
  minutes,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  minutes: number;
  onClose: () => void;
  onSave: (nextMinutes: number) => void;
}) {
  const [hour, setHour] = useState(Math.floor(minutes / 60));
  const [minute, setMinute] = useState(minutes % 60 - (minutes % 60) % 5);

  useEffect(() => {
    if (visible) {
      setHour(Math.floor(minutes / 60));
      setMinute(minutes % 60 - (minutes % 60) % 5);
    }
  }, [visible, minutes]);

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <Text style={s.title}>{title}</Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>

      <Text style={s.preview}>{formatTimeOfDay(hour * 60 + minute)}</Text>

      <View style={s.wheelCard}>
        <View style={s.selectionBand} pointerEvents="none" />
        <View style={s.wheelRow}>
          <Wheel options={HOURS} value={hour} onChange={setHour} />
          <Text style={s.colon}>:</Text>
          <Wheel options={MINUTES} value={minute} onChange={setMinute} />
        </View>
        <View style={s.fadeTop} pointerEvents="none" />
        <View style={s.fadeBottom} pointerEvents="none" />
      </View>

      <GoldButton
        label="Save"
        onPress={() => {
          onSave(hour * 60 + minute);
          onClose();
        }}
        style={{ marginTop: 16 }}
      />
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E7E5E0',
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    marginTop: 8,
    fontFamily: F.serifSemiBold,
    fontSize: 40,
    letterSpacing: 1,
    color: C.goldDark,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  wheelCard: {
    marginTop: 12,
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  selectionBand: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: WHEEL_PADDING,
    height: ITEM_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAD9B7',
    backgroundColor: '#FFFBEB',
  },
  wheelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wheelColumn: {
    width: 76,
    height: ITEM_HEIGHT * VISIBLE_ROWS,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontFamily: F.sansMedium,
    fontSize: 19,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  wheelItemTextActive: {
    fontFamily: F.sansSemiBold,
    fontSize: 21,
    color: C.goldDark,
  },
  colon: {
    fontFamily: F.serifSemiBold,
    fontSize: 26,
    color: C.textSecondary,
    marginTop: -2,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
});
