import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { OrthodoxCross, Shield } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import FocusPhoneStatus from './FocusPhoneStatus';
import GoldButton from './GoldButton';
import { grantNativeTemporaryAccess } from './focusNativeBridge';
import {
  continueIntentionalUse,
  getDayPlanState,
  groupName,
  openDoorFor,
  recordNativeBoundaryEvent,
  recordReturnedMoment,
  type PracticeKind,
  type Strength,
} from './dayPlanStore';

const CARD_TRANSITION = LinearTransition.duration(230);

type PracticeContent = {
  title: string;
  body: string;
  sub?: string;
  doneLabel: string;
};

const PRACTICE_CONTENT: Record<PracticeKind, PracticeContent> = {
  prayer: {
    title: 'Short Prayer',
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
    title: 'Psalm',
    body: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the Lord, which made heaven and earth.',
    sub: 'PSALM 121',
    doneLabel: 'I have read it',
  },
  chapter: {
    title: 'A Bible chapter',
    body: 'Open the Gospel and read one chapter slowly before you decide again.',
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
  const params = useLocalSearchParams<{
    practice?: string;
    strength?: string;
    group?: string;
    moment?: string;
    spent?: string;
    app?: string;
    native?: string;
    nativeSelection?: string;
    sourceSelection?: string;
    nativeKind?: string;
    session?: string;
    day?: string;
    plan?: string;
  }>();
  const practice: PracticeKind = params.practice && params.practice in PRACTICE_CONTENT
    ? params.practice as PracticeKind
    : 'prayer';
  const strength: Strength = params.strength === 'strict' ? 'strict' : 'loose';
  const moment = params.moment === 'checkin' ? 'checkin' : params.moment === 'always' ? 'always' : 'limit';
  const groupId = params.group ?? '';
  const sourceMinutes = Math.max(0, Number(params.spent) || 0);
  const spent = Math.max(1, sourceMinutes || 15);
  const content = PRACTICE_CONTENT[practice];
  const displayGroup = groupId ? groupName(getDayPlanState(), groupId) : 'this app';
  const subject = params.app ?? displayGroup;
  const startsWithChoice = strength === 'strict' || moment === 'checkin';
  const [step, setStep] = useState<'practice' | 'choice'>(startsWithChoice ? 'choice' : 'practice');
  const [reason, setReason] = useState('');
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const canComplete = practice !== 'intention' || reason.trim().length >= 8;
  const nativeSelection = params.native === '1' ? params.nativeSelection : undefined;

  const turnBack = () => {
    recordReturnedMoment(groupId || undefined);
    router.back();
  };

  const continueFor15 = async () => {
    if (grantingAccess) return;
    setGrantingAccess(true);
    setGrantError(null);
    try {
      if (nativeSelection) {
        await grantNativeTemporaryAccess(
          nativeSelection,
          params.sourceSelection ?? '',
          params.nativeKind ?? moment,
          sourceMinutes,
          15
        );
        if (moment !== 'checkin' && params.sourceSelection) {
          recordNativeBoundaryEvent('limit', params.sourceSelection, params.session, params.day, params.plan);
        }
      } else if (moment === 'checkin') {
        continueIntentionalUse(groupId || 'intentional-use', 15);
      } else {
        openDoorFor(groupId || 'intentional-use', 15);
      }
      router.back();
    } catch (error) {
      setGrantError(error instanceof Error
        ? error.message
        : 'The active protection changed. Return to the blocked app and try again.');
    } finally {
      setGrantingAccess(false);
    }
  };

  const headline = strength === 'strict'
    ? 'The boundary is holding.'
    : moment === 'checkin'
      ? `${spent} minutes have passed.`
      : moment === 'always'
        ? 'This app begins behind a gate.'
        : 'The limit has been used.';
  const body = strength === 'strict'
    ? `${subject} remains protected until this rule ends.`
    : moment === 'checkin'
      ? 'Notice the time before scrolling becomes automatic.'
      : 'A deliberate 15-minute continuation is available after your return practice.';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenTitleBar title="PAUSE" showBack />

        <Animated.View entering={FadeInDown.duration(420).delay(30)} style={s.phoneBlock}>
          <FocusPhoneStatus active critical={strength === 'strict'} size={150} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(90)} style={s.verseBlock}>
          <OrthodoxCross s={17} c={C.gold} w={1.6} />
          <Text style={s.verse}>“I will not be brought under the power of any.”</Text>
          <Text style={s.verseRef}>1 CORINTHIANS 6:12</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(150)} layout={CARD_TRANSITION} style={s.boundaryBand}>
          <View style={[s.boundaryIcon, strength === 'strict' && s.boundaryIconStrict]}>
            <Shield s={19} c={strength === 'strict' ? '#A24351' : C.goldDark} w={2.1} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.boundaryKicker}>{moment === 'checkin' ? 'INTENTIONAL USE CHECK-IN' : strength === 'strict' ? 'STRICT PROTECTION' : 'LOOSE PROTECTION'}</Text>
            <Text style={s.boundaryTitle}>{headline}</Text>
            <Text style={s.boundaryBody}>{body}</Text>
          </View>
        </Animated.View>

        <Animated.View layout={CARD_TRANSITION} style={s.actionSurface}>
          {step === 'practice' ? (
            <Animated.View key="practice" entering={FadeIn.duration(240)} exiting={FadeOut.duration(120)}>
              <Text style={s.actionKicker}>RETURN PRACTICE · {displayGroup.toUpperCase()}</Text>
              <Text style={s.actionTitle}>{content.title}</Text>
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
                <Text style={s.practiceBody}>{content.body}</Text>
              )}
              {!!content.sub && <Text style={s.practiceSub}>{content.sub}</Text>}
              <GoldButton label={content.doneLabel} disabled={!canComplete} onPress={() => setStep('choice')} style={{ marginTop: 17 }} />
              <GoldButton label="Turn back instead" variant="outline" onPress={turnBack} style={{ marginTop: 8 }} />
            </Animated.View>
          ) : (
            <Animated.View key="choice" entering={FadeIn.duration(240)} exiting={FadeOut.duration(120)}>
              {strength === 'strict' ? (
                <>
                  <Text style={s.choiceTitle}>No override is offered.</Text>
                  <Text style={s.choiceBody}>You chose this boundary before the moment became difficult. Focus will keep that decision.</Text>
                  <GoldButton label="Leave the app" onPress={turnBack} style={{ marginTop: 17 }} />
                </>
              ) : (
                <>
                  <Text style={s.choiceTitle}>{moment === 'checkin' ? 'Choose with awareness.' : 'The deliberate door is ready.'}</Text>
                  <Text style={s.choiceBody}>
                    {moment === 'checkin'
                      ? 'Continuing opens the next 15 minutes. This check-in alone does not lose the final limit.'
                      : 'Continuing opens one 15-minute window and records the lower-level boundary as lost for today.'}
                  </Text>
                  {!!grantError && <Text style={s.grantError}>{grantError}</Text>}
                  <GoldButton label="Leave the app" onPress={turnBack} style={{ marginTop: 17 }} />
                  <GoldButton
                    label={grantingAccess ? 'Opening 15 minutes...' : 'Continue for 15 minutes'}
                    variant="outline"
                    disabled={grantingAccess}
                    onPress={() => { void continueFor15(); }}
                    style={{ marginTop: 8 }}
                  />
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
  page: { paddingHorizontal: 16, paddingBottom: 80, gap: 15 },
  phoneBlock: { height: 145, alignItems: 'center', justifyContent: 'center' },
  verseBlock: { paddingHorizontal: 28, alignItems: 'center', gap: 8 },
  verse: { fontFamily: F.serifMediumItalic, fontSize: 18, lineHeight: 24, color: C.text, textAlign: 'center' },
  verseRef: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.1, color: C.gold },
  boundaryBand: { minHeight: 104, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 14, paddingHorizontal: 4 },
  boundaryIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  boundaryIconStrict: { backgroundColor: '#F8E7EA' },
  boundaryKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.6, color: C.textMuted },
  boundaryTitle: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  boundaryBody: { marginTop: 3, fontFamily: F.sans, fontSize: 10, lineHeight: 15, color: C.textSecondary },
  actionSurface: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E6DCC6', backgroundColor: '#FFFDF8', padding: 16 },
  actionKicker: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.7, color: C.gold },
  actionTitle: { marginTop: 6, fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  practiceBody: { marginTop: 9, fontFamily: F.serif, fontSize: 16.5, lineHeight: 24, color: C.textSecondary },
  practiceSub: { marginTop: 10, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.gold },
  reasonInput: { marginTop: 10, minHeight: 82, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 12, fontFamily: F.serif, fontSize: 15, lineHeight: 22, color: C.text, textAlignVertical: 'top' },
  choiceTitle: { fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  choiceBody: { marginTop: 5, fontFamily: F.sans, fontSize: 10.5, lineHeight: 16, color: C.textSecondary },
  grantError: { marginTop: 10, fontFamily: F.sansSemiBold, fontSize: 9.5, lineHeight: 14, color: '#A24351' },
});
