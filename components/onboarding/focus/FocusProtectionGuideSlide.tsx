import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import DayPlanHubView from '@/components/focus-watch/DayPlanHubView';
import FocusWatchView from '@/components/focus-watch/FocusWatchView';
import PlanEditorView from '@/components/focus-watch/PlanEditorView';
import PurityView from '@/components/focus-watch/PurityView';
import type { WebPackId } from '@/components/focus-watch/dayPlanStore';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';
import { useGuidedSetup } from '@/components/onboarding/guided/GuidedSetupContext';

export type FocusProtectionToolId = 'screen-time' | 'web-protection';

function recommendedWebPack(selectedProblems: string[]): WebPackId {
  if (selectedProblems.includes('ashamed-content')) return 'adult';
  if (selectedProblems.some(id => id === 'focus-pulled' || id === 'presence')) return 'social';
  if (selectedProblems.some(id => id === 'lost-hour' || id === 'procrastination')) return 'social';
  return 'news';
}

function recommendedScreenTimeMinutes(hours: number | undefined) {
  const reportedMinutes = Math.max(4, Math.min(10, hours ?? 7)) * 60;
  return Math.max(60, Math.round((reportedMinutes * 0.57) / 15) * 15);
}

export function FocusProtectionToolGuide({
  toolId,
  screenTimeHours,
  selectedProblems,
  onComplete,
}: {
  toolId: FocusProtectionToolId;
  screenTimeHours?: number;
  selectedProblems: string[];
  onComplete: () => void;
}) {
  const { beginGuidedSetup, endGuidedSetup, setPresentation } = useGuidedSetup();
  const [screenTimeScene, setScreenTimeScene] = useState<'hub' | 'editor'>('hub');
  const webPackId = useMemo(() => recommendedWebPack(selectedProblems), [selectedProblems]);
  const recommendedMinutes = useMemo(() => recommendedScreenTimeMinutes(screenTimeHours), [screenTimeHours]);

  useEffect(() => {
    setPresentation(null);
    endGuidedSetup();
    beginGuidedSetup({
      currentChapter: 'protect',
      chapterOrder: ['protect'],
      activeStep: toolId === 'screen-time' ? 'focusScreenTime' : 'focusWebProtection',
      phase: toolId === 'screen-time' ? 'hubIntro' : 'webIntro',
      route: '/onboarding',
    });
    return () => {
      setPresentation(null);
      endGuidedSetup();
    };
    // This setup owns one uninterrupted session from mount to completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    setPresentation(null);
    endGuidedSetup();
    onComplete();
  }, [endGuidedSetup, onComplete, setPresentation]);

  return (
    <Animated.View entering={FadeIn.duration(240)} style={styles.screen}>
      <View style={styles.realScreen}>
        {toolId === 'screen-time' ? (
          screenTimeScene === 'hub' ? (
            <DayPlanHubView guided onGuidedCreatePlan={() => setScreenTimeScene('editor')} />
          ) : (
            <PlanEditorView
              guided
              guidedRecommendedMinutes={recommendedMinutes}
              onGuidedComplete={finish}
            />
          )
        ) : (
          <PurityView guided guidedPackId={webPackId} onGuidedComplete={finish} />
        )}
      </View>
      <GuidedOverlayHost />
    </Animated.View>
  );
}

export function FocusOverviewGuideSlide({ onComplete }: { onComplete: () => void }) {
  const { beginGuidedSetup, endGuidedSetup, setPresentation } = useGuidedSetup();

  useEffect(() => {
    setPresentation(null);
    endGuidedSetup();
    beginGuidedSetup({
      currentChapter: 'protect',
      chapterOrder: ['protect'],
      activeStep: 'focusOverview',
      phase: 'focusIntro',
      route: '/onboarding',
    });
    return () => {
      setPresentation(null);
      endGuidedSetup();
    };
    // This screen owns the Focus overview session for its entire lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    setPresentation(null);
    endGuidedSetup();
    onComplete();
  }, [endGuidedSetup, onComplete, setPresentation]);

  return (
    <Animated.View entering={FadeIn.duration(240)} style={styles.screen}>
      <FocusWatchView guided onGuidedComplete={finish} />
      <GuidedOverlayHost />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF7F0' },
  realScreen: { flex: 1, backgroundColor: '#FAF7F0' },
});
