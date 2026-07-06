import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { OrthodoxCross, Shield } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import GuardedPhone from './GuardedPhone';
import {
  getDayPlanState,
  groupName,
  openDoorFor,
  recordReturnedMoment,
  type PracticeKind,
  type Strength,
} from './dayPlanStore';

const CARD_TRANSITION = LinearTransition.duration(230);
const DOOR_MINUTES = [5, 10, 15];

type PracticeContent = {
  title: string;
  body: string;
  sub?: string;
  doneLabel: string;
};

const PRACTICE_CONTENT: Record<PracticeKind, PracticeContent> = {
  prayer: {
    title: 'A short prayer',
    body: 'O Lord my God, guard my heart this hour. Keep me from what I do not truly want, and turn me toward what is mine to do.',
    doneLabel: 'I have prayed',
  },
  'jesus-prayer': {
    title: 'Jesus Prayer',
    body: 'Lord Jesus Christ, Son of God, have mercy on me, a sinner.',
    sub: 'REPEAT IT SLOWLY, TWELVE TIMES',
    doneLabel: 'I have prayed',
  },
  psalm: {
    title: 'A Psalm',
    body: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the Lord, which made heaven and earth.',
    sub: 'PSALM 121',
    doneLabel: 'I have read it',
  },
  chapter: {
    title: 'A Bible chapter',
    body: 'Open the Gospel and read one chapter, slowly, before this door opens.',
    doneLabel: 'I have read it',
  },
  intention: {
    title: 'Written intention',
    body: '',
    doneLabel: 'This is my reason',
  },
};

// The shield moment. A strict door never opens; a loose door opens only
// through the practice — and entering costs today's trophy (blueprint §2).
export default function InterventionView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ practice?: string; strength?: string; group?: string }>();
  const practice: PracticeKind =
    params.practice && params.practice in PRACTICE_CONTENT
      ? (params.practice as PracticeKind)
      : 'prayer';
  const strength: Strength = params.strength === 'strict' ? 'strict' : 'loose';
  const groupId = params.group ?? 'social';
  const content = PRACTICE_CONTENT[practice];
  const displayGroup = groupName(getDayPlanState(), groupId);

  const [step, setStep] = useState<'practice' | 'choice'>('practice');
  const [reason, setReason] = useState('');
  const canComplete = practice !== 'intention' || reason.trim().length >= 8;

  const turnBack = () => {
    recordReturnedMoment(groupId);
    router.back();
  };

  const enterFor = (minutes: number) => {
    openDoorFor(groupId, minutes);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitleBar title="PAUSE" showBack />

        <Animated.View entering={FadeInDown.duration(420).delay(30)} style={s.lampBlock}>
          <GuardedPhone diameter={170} sealed />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(100)} style={s.verseBlock}>
          <OrthodoxCross s={18} c={C.gold} w={1.6} />
          <Text style={s.verse}>
            {'"Watch and pray, that ye enter not into temptation."'}
          </Text>
          <Text style={s.verseRef}>MATTHEW 26:41</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(420).delay(170)}
          layout={CARD_TRANSITION}
          style={s.card}
        >
          {step === 'practice' ? (
            <Animated.View key="practice" entering={FadeIn.duration(280)} exiting={FadeOut.duration(140)}>
              <Text style={s.cardLabel}>{`THE RETURN PRACTICE · ${displayGroup.toUpperCase()}`}</Text>
              <Text style={s.cardTitle}>{content.title}</Text>

              {practice === 'intention' ? (
                <TextInput
                  style={s.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Why are you opening it?"
                  placeholderTextColor={C.textMuted}
                  multiline
                />
              ) : (
                <Text style={s.cardBody}>{content.body}</Text>
              )}

              {!!content.sub && <Text style={s.cardSub}>{content.sub}</Text>}

              <GoldButton
                label={content.doneLabel}
                disabled={!canComplete}
                onPress={() => setStep('choice')}
                style={{ marginTop: 18 }}
              />
            </Animated.View>
          ) : (
            <Animated.View key="choice" entering={FadeIn.duration(280)} exiting={FadeOut.duration(140)}>
              {strength === 'strict' ? (
                <>
                  <View style={s.strictShield}>
                    <Shield s={20} c="#B54155" w={2.2} />
                  </View>
                  <Text style={s.choiceTitle}>This door stays closed.</Text>
                  <Text style={s.choiceSub}>
                    You set it strict — and prayed anyway. That is strength.
                  </Text>
                  <GoldButton label="Turn back" onPress={turnBack} style={{ marginTop: 18 }} />
                </>
              ) : (
                <>
                  <Text style={s.choiceTitle}>The door is open.</Text>
                  <Text style={s.choiceSub}>What happens next is yours to choose.</Text>

                  <GoldButton label="Turn back" onPress={turnBack} style={{ marginTop: 18 }} />

                  <View style={s.doorRow}>
                    {DOOR_MINUTES.map(minutes => (
                      <TouchableOpacity
                        key={minutes}
                        style={s.doorChip}
                        activeOpacity={0.75}
                        onPress={() => enterFor(minutes)}
                      >
                        <Text style={s.doorChipText}>{`${minutes} min`}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.doorNote}>Entering opens the door — and costs today's trophy.</Text>
                </>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  lampBlock: {
    marginTop: 12,
    alignItems: 'center',
  },
  verseBlock: {
    marginTop: 14,
    paddingHorizontal: 34,
    alignItems: 'center',
    gap: 10,
  },
  verse: {
    fontFamily: F.serifMediumItalic,
    fontSize: 20,
    lineHeight: 27,
    color: C.text,
    textAlign: 'center',
  },
  verseRef: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.gold,
  },

  card: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 18,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  cardLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  cardTitle: {
    marginTop: 8,
    fontFamily: F.serifMedium,
    fontSize: 22,
    letterSpacing: -0.2,
    color: C.text,
  },
  cardBody: {
    marginTop: 10,
    fontFamily: F.serif,
    fontSize: 17.5,
    lineHeight: 27,
    color: C.textSecondary,
  },
  cardSub: {
    marginTop: 12,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.gold,
  },
  reasonInput: {
    marginTop: 12,
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: F.serif,
    fontSize: 16.5,
    lineHeight: 24,
    color: C.text,
    textAlignVertical: 'top',
  },

  strictShield: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBE6E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  choiceTitle: {
    marginTop: 4,
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
    textAlign: 'center',
  },
  choiceSub: {
    marginTop: 5,
    paddingHorizontal: 6,
    fontFamily: F.serif,
    fontSize: 15.5,
    lineHeight: 21,
    color: C.textSecondary,
    textAlign: 'center',
  },
  doorRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  doorChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  doorChipText: {
    fontFamily: F.sansMedium,
    fontSize: 13,
    color: C.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  doorNote: {
    marginTop: 9,
    fontFamily: F.sans,
    fontSize: 10.5,
    color: C.textMuted,
    textAlign: 'center',
  },
});
