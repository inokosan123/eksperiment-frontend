import React, { useEffect, useRef } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';

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

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateNotificationLayout() {
  try {
    LayoutAnimation.configureNext({
      duration: 260,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  } catch {
    // Web can ignore LayoutAnimation; native gets the smooth drawer.
  }
}

function useSelectionMotion(active: boolean) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 15,
      tension: 145,
      useNativeDriver: false,
    }).start();
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
              onPress={() => {
                animateNotificationLayout();
                onModeChange(key);
              }}
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
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', accent],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ECE8E0', accent],
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.015, 0.16] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.modeTouch}>
      <Animated.View
        style={[
          s.modeButton,
          {
            backgroundColor,
            borderColor,
            shadowOpacity,
            shadowColor: accent,
            transform: [{ scale }],
          },
        ]}
      >
        <Icon s={20} c={active ? '#FFFFFF' : '#A8AFBC'} w={2} />
        <Text style={[s.modeText, active && s.modeTextActive]}>{label}</Text>
      </Animated.View>
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
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 230,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  return (
    <Animated.View
      style={[
        s.reminderRow,
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
          ],
        },
      ]}
    >
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
    </Animated.View>
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
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', accent],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ECE8E0', accent],
  });

  return (
    <TouchableOpacity
      onPress={() => {
        animateNotificationLayout();
        onPress();
      }}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          s.reminderButton,
          {
            backgroundColor,
            borderColor,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={[s.reminderText, active && s.reminderTextActive]}>{minutes}m</Text>
      </Animated.View>
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
