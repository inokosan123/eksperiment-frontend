import React, { useEffect } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Reanimated, {
  FadeInUp,
  FadeOutUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Bell, BellOff, BellRing } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

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

const MODE_OPTIONS = [
  { key: 'none' as const, label: 'None', Icon: BellOff },
  { key: 'single' as const, label: 'Single', Icon: Bell },
  { key: 'double' as const, label: 'Double', Icon: BellRing },
];

const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

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
      <Text style={[s.label, { color: accent }]}>{label}</Text>

      <View style={s.modeRow}>
        {MODE_OPTIONS.map(({ key, label: optionLabel, Icon }) => {
          const active = mode === key;
          return (
            <NotificationModeButton
              key={key}
              active={active}
              label={optionLabel}
              Icon={Icon}
              accent={accent}
              onPress={() => onModeChange(key)}
            />
          );
        })}
      </View>

      {mode === 'double' && (
        <ReminderRow accent={accent} reminderMinutes={reminderMinutes} onReminderChange={onReminderChange} />
      )}
    </View>
  );
}

function NotificationModeButton({
  active,
  label,
  Icon,
  accent,
  onPress,
}: {
  active: boolean;
  label: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  accent: string;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', accent]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#ECE8E0', accent]),
    shadowOpacity: 0.015 + progress.value * 0.145,
    transform: [{ scale: 1 + progress.value * 0.018 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.modeTouch}>
      <Reanimated.View
        style={[
          s.modeButton,
          motionStyle,
          {
            shadowColor: accent,
          },
        ]}
      >
        <Icon s={20} c={active ? '#FFFFFF' : '#A8AFBC'} w={2} />
        <Text style={[s.modeText, active && s.modeTextActive]}>{label}</Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function ReminderRow({
  accent,
  reminderMinutes,
  onReminderChange,
}: {
  accent: string;
  reminderMinutes: number;
  onReminderChange: (minutes: number) => void;
}) {
  return (
    <Reanimated.View entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(140)} style={s.reminderRow}>
      {REMINDER_OPTIONS.map(minutes => {
        const active = reminderMinutes === minutes;
        return (
          <ReminderButton
          key={minutes}
          minutes={minutes}
          active={active}
          accent={accent}
          onPress={() => onReminderChange(minutes)}
          />
        );
      })}
    </Reanimated.View>
  );
}

function ReminderButton({
  minutes,
  active,
  accent,
  onPress,
}: {
  minutes: number;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', accent]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#ECE8E0', accent]),
    transform: [{ scale: 1 + progress.value * 0.04 }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Reanimated.View
        style={[
          s.reminderButton,
          motionStyle,
        ]}
      >
        <Text style={[s.reminderText, active && s.reminderTextActive]}>{minutes}m</Text>
      </Reanimated.View>
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
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  modeText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.25,
    color: '#A8AFBC',
    textTransform: 'uppercase',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  reminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderButton: {
    minWidth: 52,
    minHeight: 35,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reminderButtonActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF9EE',
  },
  reminderText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: '#A8AFBC',
  },
  reminderTextActive: {
    color: '#FFFFFF',
  },
});
