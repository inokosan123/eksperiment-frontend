import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

export const CHALLENGE_TROPHY_SOURCE = require('@/assets/animations/challenge-trophy.json');

type TrophyAnimationProps = {
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
};

export function ChallengeTrophyAnimation({
  size = 210,
  loop = false,
  autoPlay = true,
  speed = 0.96,
  style,
}: TrophyAnimationProps) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <LottieView
        source={CHALLENGE_TROPHY_SOURCE}
        autoPlay={autoPlay}
        loop={loop}
        speed={speed}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        renderMode="HARDWARE"
      />
    </View>
  );
}

export function StaticChallengeTrophy({
  size = 58,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="52" fill="#FFF4D6" />
        <Circle cx="60" cy="60" r="41" fill="#FFF9E8" />
        <Ellipse cx="60" cy="103" rx="27" ry="6" fill="#5D3E12" opacity={0.12} />
        <Path
          d="M31 28 H89 V45 C89 62.7 76 76 60 76 C44 76 31 62.7 31 45 Z"
          fill="#FFD151"
        />
        <Path
          d="M42 29 H73 C72 45 65 61 52 72 C39 68 31 57 31 45 V28 H42 Z"
          fill="#FFE582"
          opacity={0.95}
        />
        <Path
          d="M82 32 H104 V43 C104 57 93.6 68 80 69"
          fill="none"
          stroke="#FBCB4A"
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M38 32 H16 V43 C16 57 26.4 68 40 69"
          fill="none"
          stroke="#FBCB4A"
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M41 32 H18 V43 C18 52.5 24 60.5 33 63"
          fill="none"
          stroke="#FFE78A"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M86 32 H102 V43 C102 52.5 96 60.5 87 63"
          fill="none"
          stroke="#FFE78A"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Rect x="53" y="72" width="14" height="20" rx="5" fill="#ECA72A" />
        <Path d="M43 92 H77 L84 102 H36 Z" fill="#FFD151" />
        <Path d="M31 100 H89 C94 100 98 104 98 109 H22 C22 104 26 100 31 100 Z" fill="#ECA72A" />
        <Path
          d="M43 39 C49 35 61 34 70 37"
          fill="none"
          stroke="#FFF7C7"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.9}
        />
        <Path
          d="M80 41 C79 52 74 62 66 67"
          fill="none"
          stroke="#B96E11"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.24}
        />
        <Circle cx="80" cy="31" r="5" fill="#FFFFFF" opacity={0.82} />
      </Svg>
    </View>
  );
}
