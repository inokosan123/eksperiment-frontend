import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { ChapelLamp } from './NowPanel';
import { recordReturnedMoment, type PracticeKind } from './focusWatchStore';

const CARD_TRANSITION = LinearTransition.springify().damping(19).stiffness(190);

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

export default function InterventionView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ practice?: string }>();
  const practice: PracticeKind =
    params.practice && params.practice in PRACTICE_CONTENT
      ? (params.practice as PracticeKind)
      : 'prayer';
  const content = PRACTICE_CONTENT[practice];

  const [step, setStep] = useState<'practice' | 'choice'>('practice');
  const [reason, setReason] = useState('');
  const canComplete = practice !== 'intention' || reason.trim().length >= 8;

  const turnBack = () => {
    recordReturnedMoment();
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
          <ChapelLamp />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(100)} style={s.verseBlock}>
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
              <Text style={s.cardLabel}>THE RETURN PRACTICE</Text>
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

              <TouchableOpacity
                style={[s.primaryBtn, !canComplete && { opacity: 0.4 }]}
                activeOpacity={0.85}
                haptic="medium"
                disabled={!canComplete}
                onPress={() => setStep('choice')}
              >
                <Text style={s.primaryBtnText}>{content.doneLabel}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View key="choice" entering={FadeIn.duration(280)} exiting={FadeOut.duration(140)}>
              <Text style={s.choiceTitle}>The door is open.</Text>
              <Text style={s.choiceSub}>What happens next is yours to choose.</Text>

              <TouchableOpacity
                style={s.primaryBtn}
                activeOpacity={0.85}
                haptic="medium"
                onPress={turnBack}
              >
                <Text style={s.primaryBtnText}>Turn back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.ghostBtn}
                activeOpacity={0.75}
                onPress={() => router.back()}
              >
                <Text style={s.ghostBtnText}>Enter for 5 minutes</Text>
              </TouchableOpacity>
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
    marginTop: 16,
    paddingHorizontal: 34,
    alignItems: 'center',
  },
  verse: {
    fontFamily: F.serifMediumItalic,
    fontSize: 20,
    lineHeight: 27,
    color: C.text,
    textAlign: 'center',
  },
  verseRef: {
    marginTop: 10,
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

  primaryBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 999,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    fontFamily: F.sansSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#fff',
  },
  ghostBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontFamily: F.sansMedium,
    fontSize: 14,
    color: C.textSecondary,
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
    fontFamily: F.serif,
    fontSize: 15.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
});
