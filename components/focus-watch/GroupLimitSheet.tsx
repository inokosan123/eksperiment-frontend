import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Book, Cross, Feather, Flame, Minus, OpenBook, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import LimitSlider from './LimitSlider';
import { CATEGORY_TINTS, type MockApp } from './focusContent';
import {
  formatMinutesShort,
  RETURN_PRACTICES,
  type GroupRule,
  type PracticeKind,
  type Strength,
} from './dayPlanStore';

const STEP = 15;
const enter = (delay: number) => FadeInDown.duration(340).delay(delay);

const PRACTICE_ICONS: Record<PracticeKind, (color: string) => React.ReactNode> = {
  prayer: color => <Cross s={13} c={color} w={2} />,
  'jesus-prayer': color => <Flame s={14} filled color={color} />,
  psalm: color => <OpenBook s={14} c={color} w={2} />,
  chapter: color => <Book s={14} c={color} w={2} />,
  intention: color => <Feather s={14} c={color} w={2} />,
};

// The spacious room where one group's rule is shaped: how much a day, how
// firm the door, which practice opens it — and, inside the group, how the
// time is shared between its apps.
export default function GroupLimitSheet({
  rule,
  groupLabel,
  apps,
  planStrength,
  onChange,
  onClose,
}: {
  rule: GroupRule | null;
  groupLabel: string;
  apps: MockApp[];
  planStrength: Strength;
  onChange: (partial: Partial<GroupRule>) => void;
  onClose: () => void;
}) {
  const visible = rule !== null;
  const limited = rule?.dailyMinutes != null;
  const splits = rule?.appSplits ?? {};
  const assigned = Object.values(splits).reduce((sum, minutes) => sum + minutes, 0);
  const free = Math.max(0, (rule?.dailyMinutes ?? 0) - assigned);

  const setMinutes = (minutes: number | null) => {
    if (!rule) return;
    const partial: Partial<GroupRule> = { dailyMinutes: minutes };
    // A fresh limit inherits the plan's firmness; clearing the limit clears slices.
    if (rule.dailyMinutes == null && minutes != null) partial.strength = planStrength;
    if (minutes == null) partial.appSplits = undefined;
    else if (assigned > minutes) {
      // Shrunk below what is sliced out — trim slices proportionally from the end.
      const next: Record<string, number> = {};
      let left = minutes;
      for (const [appId, slice] of Object.entries(splits)) {
        const take = Math.min(slice, left);
        if (take > 0) next[appId] = take;
        left -= take;
      }
      partial.appSplits = Object.keys(next).length > 0 ? next : undefined;
    }
    onChange(partial);
  };

  const nudgeApp = (appId: string, delta: number) => {
    if (!rule || rule.dailyMinutes == null) return;
    const current = splits[appId] ?? 0;
    const headroom = rule.dailyMinutes - assigned + current;
    const next = Math.max(0, Math.min(headroom, current + delta));
    const nextSplits = { ...splits };
    if (next <= 0) delete nextSplits[appId];
    else nextSplits[appId] = next;
    onChange({ appSplits: Object.keys(nextSplits).length > 0 ? nextSplits : undefined });
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
      {/* The sheet lives in a native Modal — a separate native tree that is NOT
          under the app root's GestureHandlerRootView. Without this local root,
          the slider's GestureDetector crashes the app on Android. */}
      <GestureHandlerRootView>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>DAILY LIMIT</Text>
          <Text style={s.title} numberOfLines={1}>
            {groupLabel}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <Animated.View entering={enter(30)} style={s.valueBlock}>
          <Text style={s.valueText}>
            {rule?.dailyMinutes != null ? formatMinutesShort(rule.dailyMinutes) : 'Off'}
          </Text>
          <Text style={s.valueCaption}>
            {rule?.dailyMinutes != null ? 'A DAY WITH THIS PLAN' : 'NO LIMIT ON THIS GROUP'}
          </Text>
          <LimitSlider value={rule?.dailyMinutes ?? null} onChange={setMinutes} />
        </Animated.View>

        {limited && rule && (
          <Animated.View entering={FadeIn.duration(260)}>
            <Animated.View entering={enter(80)}>
              <Text style={s.sectionLabel}>HOW FIRM</Text>
              <View style={s.strengthRow}>
                {(['loose', 'strict'] as Strength[]).map(option => {
                  const selected = rule.strength === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[s.strengthCard, selected && s.strengthCardOn]}
                      activeOpacity={0.85}
                      haptic="selection"
                      onPress={() => onChange({ strength: option })}
                    >
                      <Text style={[s.strengthTitle, selected && { color: '#6D4F13' }]}>
                        {option === 'loose' ? 'Loose' : 'Strict'}
                      </Text>
                      <Text style={s.strengthDesc}>
                        {option === 'loose'
                          ? 'Practice opens the door — costs the trophy.'
                          : 'Held shut until tomorrow.'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View entering={enter(130)}>
              <Text style={s.sectionLabel}>RETURN PRACTICE</Text>
              <View style={s.practiceWrap}>
                {RETURN_PRACTICES.map(practice => {
                  const selected = rule.practice === practice.id;
                  const color = selected ? C.goldDark : C.textSecondary;
                  return (
                    <TouchableOpacity
                      key={practice.id}
                      style={[s.practiceChip, selected && s.practiceChipOn]}
                      activeOpacity={0.8}
                      haptic="selection"
                      onPress={() => onChange({ practice: practice.id })}
                    >
                      {PRACTICE_ICONS[practice.id](color)}
                      <Text style={[s.practiceChipText, selected && s.practiceChipTextOn]}>
                        {practice.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>

            {apps.length > 0 && (
              <Animated.View entering={enter(180)}>
                <Text style={s.sectionLabel}>SHARE IT BETWEEN APPS</Text>
                <View style={s.appsCard}>
                  {apps.map((app, index) => {
                    const tint = CATEGORY_TINTS[app.categoryId] ?? { bg: '#EFEEEB', color: '#5B564F' };
                    const slice = splits[app.id] ?? 0;
                    return (
                      <View key={app.id}>
                        {index > 0 && <View style={s.separator} />}
                        <View style={s.appRow}>
                          <View style={[s.appAvatar, { backgroundColor: tint.bg }]}>
                            <Text style={[s.appAvatarText, { color: tint.color }]}>
                              {app.name[0]}
                            </Text>
                          </View>
                          <Text style={s.appName} numberOfLines={1}>
                            {app.name}
                          </Text>
                          <View style={s.stepper}>
                            <TouchableOpacity
                              style={[s.stepBtn, slice <= 0 && s.stepBtnDim]}
                              activeOpacity={0.75}
                              haptic="selection"
                              disabled={slice <= 0}
                              onPress={() => nudgeApp(app.id, -STEP)}
                            >
                              <Minus s={12} c={C.textSecondary} w={2.4} />
                            </TouchableOpacity>
                            <Text style={[s.stepValue, slice <= 0 && s.stepValueDim]}>
                              {slice > 0 ? formatMinutesShort(slice) : '—'}
                            </Text>
                            <TouchableOpacity
                              style={[s.stepBtn, free <= 0 && slice >= 0 && free === 0 && s.stepBtnDim]}
                              activeOpacity={0.75}
                              haptic="selection"
                              disabled={free <= 0}
                              onPress={() => nudgeApp(app.id, STEP)}
                            >
                              <Plus s={12} c={C.textSecondary} w={2.4} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={s.appsFootnote}>
                  {assigned > 0
                    ? `${formatMinutesShort(assigned)} given to apps · ${formatMinutesShort(free)} shared freely`
                    : 'Nothing sliced out — the whole limit is shared freely.'}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
      </GestureHandlerRootView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 26,
    maxHeight: '88%',
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
    marginTop: 14,
    marginBottom: 4,
    gap: 10,
  },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: C.gold,
  },
  title: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 25,
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

  valueBlock: {
    marginTop: 8,
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  valueText: {
    fontFamily: F.serifSemiBold,
    fontSize: 40,
    lineHeight: 44,
    color: C.goldDark,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  valueCaption: {
    marginTop: 2,
    marginBottom: 6,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textMuted,
    textAlign: 'center',
  },

  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  strengthRow: {
    flexDirection: 'row',
    gap: 8,
  },
  strengthCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  strengthCardOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  strengthTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    color: C.text,
  },
  strengthDesc: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: C.textSecondary,
  },
  practiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  practiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  practiceChipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  practiceChipText: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  practiceChipTextOn: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
  },

  appsCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 54,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  appAvatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appAvatarText: {
    fontFamily: F.sansBold,
    fontSize: 13,
  },
  appName: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 14,
    color: C.text,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDim: {
    opacity: 0.35,
  },
  stepValue: {
    minWidth: 42,
    textAlign: 'center',
    fontFamily: F.sansSemiBold,
    fontSize: 12.5,
    color: C.goldDark,
    fontVariant: ['tabular-nums'],
  },
  stepValueDim: {
    color: C.textMuted,
  },
  appsFootnote: {
    marginTop: 8,
    marginHorizontal: 6,
    fontFamily: F.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: C.textMuted,
  },
});
