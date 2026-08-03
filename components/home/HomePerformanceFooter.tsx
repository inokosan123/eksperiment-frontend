import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AppState, type LayoutChangeEvent, View } from 'react-native';
import WeeklyRhythm from './WeeklyRhythm';
import OrganizeSection from './ExploreSection';
import { AmbientMotionProvider } from '@/components/shared/ambient-motion';
import { RibbonMotionProvider } from '@/components/shared/RibbonSectionCard';
import { viewportMaskChanged } from '@/components/shared/use-viewport-motion-budget';
import {
  getHomeFooterMotionState,
  type HomeMotionFrame,
} from './home-footer-motion';

export type HomePerformanceFooterHandle = {
  updateViewport: (scrollY: number) => void;
};

type Props = {
  viewportHeight: number;
};

type WeeklyZoneProps = {
  motionEnabled: boolean;
  dataActive: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
};

const WeeklyZone = memo(function WeeklyZone({
  motionEnabled,
  dataActive,
  onLayout,
}: WeeklyZoneProps) {
  return (
    <View onLayout={onLayout}>
      <AmbientMotionProvider active={motionEnabled}>
        <WeeklyRhythm active={motionEnabled} dataActive={dataActive} />
      </AmbientMotionProvider>
    </View>
  );
});

type OrganizeZoneProps = {
  screenEnabled: boolean;
  activeMask: number;
  onSectionLayout: (event: LayoutChangeEvent) => void;
  onCardLayout: (index: number, event: LayoutChangeEvent) => void;
};

const OrganizeZone = memo(function OrganizeZone({
  screenEnabled,
  activeMask,
  onSectionLayout,
  onCardLayout,
}: OrganizeZoneProps) {
  return (
    <RibbonMotionProvider active={screenEnabled && activeMask !== 0}>
      <OrganizeSection
        motionEnabled={screenEnabled}
        activeMask={activeMask}
        onSectionLayout={onSectionLayout}
        onCardLayout={onCardLayout}
      />
    </RibbonMotionProvider>
  );
});

const HomePerformanceFooter = memo(forwardRef<HomePerformanceFooterHandle, Props>(
  function HomePerformanceFooter({ viewportHeight }, ref) {
    const isFocused = useIsFocused();
    const [isForeground, setIsForeground] = useState(
      AppState.currentState == null || AppState.currentState === 'active',
    );
    const [weeklyActive, setWeeklyActive] = useState(false);
    const [organizeMask, setOrganizeMask] = useState(0);
    const weeklyActiveRef = useRef(false);
    const organizeMaskRef = useRef(0);
    const footerFrameRef = useRef<HomeMotionFrame>({ y: Number.POSITIVE_INFINITY, height: 0 });
    const weeklyFrameRef = useRef<HomeMotionFrame>({ y: Number.POSITIVE_INFINITY, height: 0 });
    const organizeTopRef = useRef(Number.POSITIVE_INFINITY);
    const organizeFramesRef = useRef(new Map<number, HomeMotionFrame>());
    const lastScrollYRef = useRef(0);

    const updateMotionBudget = useCallback((scrollY: number) => {
      lastScrollYRef.current = scrollY;
      const next = getHomeFooterMotionState({
        scrollY,
        viewportHeight,
        footerFrame: footerFrameRef.current,
        weeklyFrame: weeklyFrameRef.current,
        organizeTop: organizeTopRef.current,
        organizeFrames: organizeFramesRef.current,
      });

      if (weeklyActiveRef.current !== next.weeklyActive) {
        weeklyActiveRef.current = next.weeklyActive;
        setWeeklyActive(next.weeklyActive);
      }
      if (viewportMaskChanged(organizeMaskRef.current, next.organizeMask)) {
        organizeMaskRef.current = next.organizeMask;
        setOrganizeMask(next.organizeMask);
      }
    }, [viewportHeight]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      footerFrameRef.current = { y, height };
      updateMotionBudget(lastScrollYRef.current);
    }, [updateMotionBudget]);

    const handleWeeklyLayout = useCallback((event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      const current = weeklyFrameRef.current;
      if (current.y === y && current.height === height) return;
      weeklyFrameRef.current = { y, height };
      updateMotionBudget(lastScrollYRef.current);
    }, [updateMotionBudget]);

    const handleOrganizeLayout = useCallback((event: LayoutChangeEvent) => {
      organizeTopRef.current = event.nativeEvent.layout.y;
      updateMotionBudget(lastScrollYRef.current);
    }, [updateMotionBudget]);

    const handleOrganizeCardLayout = useCallback((index: number, event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      const current = organizeFramesRef.current.get(index);
      if (current?.y === y && current.height === height) return;
      organizeFramesRef.current.set(index, { y, height });
      updateMotionBudget(lastScrollYRef.current);
    }, [updateMotionBudget]);

    useImperativeHandle(ref, () => ({ updateViewport: updateMotionBudget }), [updateMotionBudget]);

    useEffect(() => {
      const subscription = AppState.addEventListener('change', next => {
        setIsForeground(next === 'active');
      });
      return () => subscription.remove();
    }, []);

    const screenEnabled = isFocused && isForeground;
    const weeklyMotionEnabled = screenEnabled && weeklyActive;

    return (
      <View onLayout={handleLayout}>
        <WeeklyZone
          motionEnabled={weeklyMotionEnabled}
          dataActive={screenEnabled}
          onLayout={handleWeeklyLayout}
        />
        <OrganizeZone
          screenEnabled={screenEnabled}
          activeMask={organizeMask}
          onSectionLayout={handleOrganizeLayout}
          onCardLayout={handleOrganizeCardLayout}
        />
      </View>
    );
  },
));

HomePerformanceFooter.displayName = 'HomePerformanceFooter';

export default HomePerformanceFooter;
