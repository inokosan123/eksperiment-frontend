import React, { useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, {
  FadeIn,
  FadeOut,
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useGuidedSetup } from './GuidedSetupContext';

const APP_LOGO = require('@/assets/images/anasta-logo.png');
const DIM = 'rgba(19,17,15,0.70)';
const MOTION = { duration: 520, easing: Easing.bezier(0.16, 1, 0.28, 1) };
const CUTOUT_RADIUS = 22;

function DimPanel({ style }: { style: object }) {
  return (
    <Reanimated.View style={[o.dimPanel, style]}>
      <Pressable style={StyleSheet.absoluteFill} />
    </Reanimated.View>
  );
}

export function GuidedOverlayHost() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { session, presentation, targetLayouts } = useGuidedSetup();
  const target = presentation?.targetId ? targetLayouts[presentation.targetId] : undefined;
  const padding = presentation?.cutoutPadding ?? 8;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (!target) return;
    const nextX = Math.max(0, target.x - padding);
    const nextY = Math.max(0, target.y - padding);
    x.value = withTiming(nextX, MOTION);
    y.value = withTiming(nextY, MOTION);
    width.value = withTiming(Math.max(0, Math.min(screenWidth - nextX, target.width + padding * 2)), MOTION);
    height.value = withTiming(Math.max(0, Math.min(screenHeight - nextY, target.height + padding * 2)), MOTION);
  }, [height, padding, screenHeight, screenWidth, target, width, x, y]);

  const topStyle = useAnimatedStyle(() => ({
    left: 0,
    right: 0,
    top: 0,
    height: y.value,
  }));
  const leftStyle = useAnimatedStyle(() => ({
    left: 0,
    top: y.value,
    width: x.value,
    height: height.value,
  }));
  const rightStyle = useAnimatedStyle(() => ({
    left: x.value + width.value,
    right: 0,
    top: y.value,
    height: height.value,
  }));
  const bottomStyle = useAnimatedStyle(() => ({
    left: 0,
    right: 0,
    top: y.value + height.value,
    bottom: 0,
  }));
  const cutoutStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
  }));
  const topLeftCornerStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
  }));
  const topRightCornerStyle = useAnimatedStyle(() => ({
    left: x.value + width.value - CUTOUT_RADIUS,
    top: y.value,
  }));
  const bottomLeftCornerStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value + height.value - CUTOUT_RADIUS,
  }));
  const bottomRightCornerStyle = useAnimatedStyle(() => ({
    left: x.value + width.value - CUTOUT_RADIUS,
    top: y.value + height.value - CUTOUT_RADIUS,
  }));

  const bubbleStyle = useMemo(() => {
    if (presentation?.celebrate) {
      return { top: Math.max(96, screenHeight * 0.52) };
    }
    if (!target || presentation?.placement === 'center') {
      return { top: Math.max(96, screenHeight * 0.28) };
    }
    if (presentation?.placement === 'above') {
      return { bottom: Math.max(24, screenHeight - target.y + 20) };
    }
    return { top: Math.min(screenHeight - 190, target.y + target.height + 22) };
  }, [presentation?.placement, screenHeight, target]);

  if (!session?.active || !presentation) return null;

  return (
    <View pointerEvents="box-none" style={o.layer}>
      {target ? (
        <>
          <DimPanel style={topStyle} />
          <DimPanel style={leftStyle} />
          <DimPanel style={rightStyle} />
          <DimPanel style={bottomStyle} />
          <DimPanel style={[o.cutoutCorner, o.cutoutCornerTopLeft, topLeftCornerStyle]} />
          <DimPanel style={[o.cutoutCorner, o.cutoutCornerTopRight, topRightCornerStyle]} />
          <DimPanel style={[o.cutoutCorner, o.cutoutCornerBottomLeft, bottomLeftCornerStyle]} />
          <DimPanel style={[o.cutoutCorner, o.cutoutCornerBottomRight, bottomRightCornerStyle]} />
          <Reanimated.View pointerEvents="none" style={[o.cutout, cutoutStyle]} />
          {presentation.allowTargetInteraction === false && (
            <Reanimated.View style={[o.cutoutBlocker, cutoutStyle]}>
              <Pressable style={StyleSheet.absoluteFill} />
            </Reanimated.View>
          )}
        </>
      ) : (
        <View style={o.fullDim}>
          <Pressable style={StyleSheet.absoluteFill} />
        </View>
      )}

      {presentation.celebrate && (
        <Reanimated.View
          key={`${presentation.key}-success`}
          entering={ZoomIn.springify().damping(13).stiffness(150).mass(0.8)}
          style={[o.successWrap, { top: Math.max(92, screenHeight * 0.28) }]}
        >
          <View style={o.successHalo} />
          <View style={o.successMark}>
            <CheckSmall s={34} c="#FFFFFF" w={3.2} />
          </View>
        </Reanimated.View>
      )}

      <Reanimated.View
        key={presentation.key}
        entering={FadeIn.duration(420)}
        exiting={FadeOut.duration(240)}
        style={[o.coach, bubbleStyle]}
      >
        <View style={o.logoPlate}>
          <View style={o.logoHalo} />
          <Image source={APP_LOGO} style={o.logo} resizeMode="cover" />
        </View>
        <View style={o.bubble}>
          <View style={o.bubbleTail} />
          <View style={o.bubbleTailJoin} />
          <Text style={o.message}>{presentation.message}</Text>
        </View>
      </Reanimated.View>

      {presentation.ctaLabel && presentation.onCta && (
        <Reanimated.View entering={FadeIn.delay(220).duration(420)} style={o.ctaWrap}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={presentation.onCta} style={o.cta}>
            <Text style={o.ctaText}>{presentation.ctaLabel}</Text>
          </TouchableOpacity>
          {presentation.secondaryCtaLabel && presentation.onSecondaryCta && (
            <TouchableOpacity
              activeOpacity={0.84}
              haptic="light"
              onPress={presentation.onSecondaryCta}
              style={o.secondaryCta}
            >
              <Text style={o.secondaryCtaText}>{presentation.secondaryCtaLabel}</Text>
            </TouchableOpacity>
          )}
        </Reanimated.View>
      )}
    </View>
  );
}

const o = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  dimPanel: {
    position: 'absolute',
    backgroundColor: DIM,
  },
  fullDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DIM,
  },
  cutout: {
    position: 'absolute',
    borderRadius: CUTOUT_RADIUS,
    borderWidth: 1.5,
    borderColor: 'rgba(240,209,143,0.92)',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  cutoutBlocker: {
    position: 'absolute',
    borderRadius: CUTOUT_RADIUS,
  },
  cutoutCorner: {
    width: CUTOUT_RADIUS,
    height: CUTOUT_RADIUS,
  },
  cutoutCornerTopLeft: {
    borderTopLeftRadius: CUTOUT_RADIUS,
  },
  cutoutCornerTopRight: {
    borderTopRightRadius: CUTOUT_RADIUS,
  },
  cutoutCornerBottomLeft: {
    borderBottomLeftRadius: CUTOUT_RADIUS,
  },
  cutoutCornerBottomRight: {
    borderBottomRightRadius: CUTOUT_RADIUS,
  },
  successWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHalo: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(197,160,89,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(240,209,143,0.46)',
  },
  successMark: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gold,
    borderWidth: 5,
    borderColor: '#FFF6DE',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 20,
    elevation: 8,
  },
  coach: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  logoPlate: {
    width: 60,
    height: 60,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 3,
  },
  logoHalo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(197,160,89,0.07)',
    transform: [{ rotate: '12deg' }],
  },
  logo: {
    width: 47,
    height: 47,
    borderRadius: 14,
  },
  bubble: {
    minHeight: 54,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFCF6',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
  },
  bubbleTail: {
    display: 'none',
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#FFFCF6',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
  },
  bubbleTailJoin: {
    display: 'none',
    position: 'absolute',
    left: -1,
    top: '50%',
    marginTop: -12,
    width: 12,
    height: 24,
    backgroundColor: '#FFFCF6',
  },
  message: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'left',
    color: C.text,
  },
  ctaWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 22,
    gap: 8,
  },
  cta: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#1B1917',
  },
  ctaText: {
    fontFamily: F.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  secondaryCta: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#FFFCF6',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
  },
  secondaryCtaText: {
    fontFamily: F.sansBold,
    fontSize: 13,
    letterSpacing: 0,
    color: C.text,
  },
});
