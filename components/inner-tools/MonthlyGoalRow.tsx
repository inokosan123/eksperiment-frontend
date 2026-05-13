import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CheckSmall } from '@/components/icons/Icons';
import { CompletionFlourish } from '@/components/shared/taskAnimations';
import { playTaskCompleteFeedback, playTaskUndoFeedback } from '@/components/shared/taskFeedback';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const GOLD = '#C5A059';

type AnimatedGoalCheckProps = {
  done: boolean;
  onPress: () => void;
  size?: number;
  burstColor?: string;
};

// Reusable check circle that fires the same celebratory burst as task
// completion. Layered so the burst expands beyond the circle's bounds.
export function AnimatedGoalCheck({
  done,
  onPress,
  size = 22,
  burstColor = GOLD,
}: AnimatedGoalCheckProps) {
  const fill = useSharedValue(done ? 1 : 0);
  const previousDone = useRef(done);

  useEffect(() => {
    const becameDone = !previousDone.current && done;
    const becameUndone = previousDone.current && !done;
    previousDone.current = done;

    if (becameDone) {
      fill.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else if (becameUndone) {
      fill.value = withTiming(0, { duration: 160 });
    }
  }, [done, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.6 + fill.value * 0.4 }],
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: fill.value < 0.5 ? 0 : (fill.value - 0.5) * 2,
    transform: [{ scale: 0.7 + fill.value * 0.3 }],
  }));

  const innerSize = size;
  const burstSize = size * 3.6;

  return (
    <View style={{ width: innerSize, height: innerSize, alignItems: 'center', justifyContent: 'center' }}>
      {/* Burst sits behind the button; pointerEvents: 'none' inside the
          flourish layer keeps it from intercepting taps. */}
      <CompletionFlourish
        done={done}
        color={burstColor}
        layerStyle={{
          width: burstSize,
          height: burstSize,
        }}
      />
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.78}
        hitSlop={8}
        style={[
          s.checkBtn,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      >
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0, top: 0, right: 0, bottom: 0,
              borderRadius: innerSize / 2,
              backgroundColor: burstColor,
            },
            fillStyle,
          ]}
        />
        <Reanimated.View pointerEvents="none" style={tickStyle}>
          <CheckSmall s={Math.round(size * 0.55)} c="#FFFFFF" w={3} />
        </Reanimated.View>
      </TouchableOpacity>
    </View>
  );
}

type AnimatedStrikeTextProps = {
  text: string;
  done: boolean;
  textStyle?: StyleProp<TextStyle>;
  doneColor?: string;
  lineColor?: string;
  numberOfLines?: number;
};

// Text with an animated strike-through line that draws left → right when
// `done` flips true (and retracts when undone). Mirrors TaskTitle's pattern:
// a hidden absolute Text gives intrinsic width; visible Text fills the
// flex slot; strike width = min(intrinsic, container).
export function AnimatedStrikeText({
  text,
  done,
  textStyle,
  doneColor = '#A8A29E',
  lineColor = 'rgba(28,25,23,0.42)',
  numberOfLines = 2,
}: AnimatedStrikeTextProps) {
  const progress = useSharedValue(done ? 1 : 0);
  const previousDone = useRef(done);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const drawWidth = Math.min(naturalWidth, containerWidth);

  useEffect(() => {
    const becameDone = !previousDone.current && done;
    const becameUndone = previousDone.current && !done;
    previousDone.current = done;
    if (becameDone) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 1150,
        easing: Easing.out(Easing.cubic),
      });
    } else if (becameUndone) {
      progress.value = withTiming(0, { duration: 200 });
    }
  }, [done, progress]);

  const lineStyle = useAnimatedStyle(() => ({
    width: drawWidth * progress.value,
    opacity: progress.value < 0.05 ? 0 : 1,
  }));

  const colorStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.45,
  }));

  const handleNatural = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - naturalWidth) > 0.5) setNaturalWidth(w);
  };
  const handleContainer = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - containerWidth) > 0.5) setContainerWidth(w);
  };

  // Text style needs to account for both the active and "done" colour:
  // we keep the active colour stable and animate opacity instead, so the
  // colour transition feels smooth alongside the strike sweep.
  const flatStyle = StyleSheet.flatten(textStyle) || {};
  const lineHeight = (flatStyle as TextStyle).lineHeight ?? 20;
  const stableColor = done ? doneColor : (flatStyle as TextStyle).color ?? '#1A1714';

  return (
    <View
      onLayout={handleContainer}
      style={{ flex: 1, minWidth: 0, position: 'relative' }}
    >
      <Text
        onLayout={handleNatural}
        style={{
          position: 'absolute',
          opacity: 0,
          ...((flatStyle as TextStyle).fontFamily ? { fontFamily: (flatStyle as TextStyle).fontFamily } : {}),
          ...((flatStyle as TextStyle).fontSize ? { fontSize: (flatStyle as TextStyle).fontSize } : {}),
          ...((flatStyle as TextStyle).lineHeight ? { lineHeight: (flatStyle as TextStyle).lineHeight } : {}),
        }}
      >
        {text}
      </Text>
      <Reanimated.Text
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
        style={[
          textStyle,
          { color: stableColor },
          colorStyle,
        ]}
      >
        {text}
      </Reanimated.Text>
      {drawWidth > 0 && (
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: lineHeight / 2,
              height: 1.2,
              borderRadius: 1,
              backgroundColor: lineColor,
            },
            lineStyle,
          ]}
        />
      )}
    </View>
  );
}

// Convenience: fires the same celebratory feedback as task completion —
// soft chime + Heavy/Success/Light haptic cascade on complete, light tap
// on uncomplete. Called from the row's onPress so Home / Page / Daily
// Entry all share one feedback vocabulary.
export function fireGoalToggleHaptic(willComplete: boolean) {
  if (willComplete) {
    void playTaskCompleteFeedback();
  } else {
    playTaskUndoFeedback();
  }
}

const s = StyleSheet.create({
  checkBtn: {
    borderWidth: 2,
    borderColor: '#D6D3D1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
});
