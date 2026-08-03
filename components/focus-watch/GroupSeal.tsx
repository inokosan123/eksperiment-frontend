import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Lock } from '@/components/icons/Icons';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { C, F } from '@/constants/tokens';
import { CATEGORY_TINTS } from './focusContent';

// One group, drawn once for the whole app: the category's face set in a disc of
// its own colour, ringed by the share of the day it has been given. Every
// surface that lists groups (plan rules, today's breakdown, the group sheets)
// can wear the same seal, so a group looks like itself wherever you meet it.
//
// It carries the app's seal grammar — the same construction as the Goal trophy,
// the Tolerance shield and the Essentials lock.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const GROUP_EMOJI: Record<string, string> = {
  social: 'mobile-phone',
  entertainment: 'movie-camera',
  games: 'joker',
  news: 'newspaper',
  shopping: 'money-bag',
  dating: 'red-heart',
};

const BLOCKED_COLOR = '#A24351';
// Scarlet, not the block's rose: a passed boundary is a different event.
const OVER_COLOR = '#BE123C';

export function groupTint(groupId: string) {
  return CATEGORY_TINTS[groupId] ?? { bg: C.goldLight, color: C.goldDark };
}

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(169,134,63,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export default function GroupSeal({
  groupId,
  name,
  size = 46,
  share = 0,
  blocked = false,
  dim = false,
  tone,
  icon,
  marker,
}: {
  groupId: string;
  name: string;
  size?: number;
  /** The group's slice of the goal, 0–1. Drawn as a ring around the disc. */
  share?: number;
  blocked?: boolean;
  /** No rule set yet: the seal rests, so ruled groups read as the lit ones. */
  dim?: boolean;
  /**
   * Struck in a colour the caller supplies rather than the group's own tint.
   *
   * ⚠️ Wherever a seal sits ON a rule — a card, a sheet — its colour must be
   * the rule's STATE, not the group's identity, or the card ends up wearing two
   * colours at once. The group's own tint is right only where several groups
   * are shown together and have to be told apart. See `RULE_TONES`.
   */
  tone?: { color: string; bg: string };
  /**
   * A custom group's chosen face. The built-in groups carry theirs in
   * `GROUP_EMOJI`; a group you made yourself carries its own, and falls back to
   * its initial when it has none.
   */
  icon?: string;
  /**
   * What is struck on the face's corner. `lock` is a configured block; `warning`
   * is a boundary that was passed. They must never be interchangeable, so they
   * are different shapes in different colours — see `FOCUS_BOUNDARY_TONES`.
   */
  marker?: 'none' | 'lock' | 'warning';
}) {
  const reduceMotion = useReducedMotion();
  const tint = tone ?? groupTint(groupId);
  const accent = blocked ? BLOCKED_COLOR : tint.color;
  const emoji = icon ?? GROUP_EMOJI[groupId];

  // The ring orbits just outside the disc.
  const ringSize = size + 11;
  const badgeSize = Math.round(size * 0.43);
  // Pulled in from the ring's corner so the badge's centre lands INSIDE the
  // disc's rim; at 9% of the ring it overlaps by about half.
  const badgeInset = Math.round(ringSize * 0.09);
  const radius = (ringSize - 3) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, share));
  const progress = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion, target]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      {share > 0 && (
        <Svg
          pointerEvents="none"
          width={ringSize}
          height={ringSize}
          style={StyleSheet.absoluteFill}
        >
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={accent}
            strokeOpacity={0.16}
            strokeWidth={2.6}
            fill="none"
          />
          <AnimatedCircle
            animatedProps={arcProps}
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={accent}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
          />
        </Svg>
      )}

      <View
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: blocked ? '#FBE9EC' : tint.bg,
            borderColor: withAlpha(accent, dim ? 0.18 : 0.3),
          },
        ]}
      >
        {emoji
          ? <NotoEmoji name={emoji as never} size={size * 0.55} />
          : <Text style={[styles.letter, { fontSize: size * 0.42, color: accent }]}>{name.charAt(0).toUpperCase()}</Text>}
      </View>

      {/* The lock sits ON the disc's rim, overlapping it, rather than hanging
          off the corner of the ring — it is part of the face, not a sticker
          placed beside it. Measured from the ring so it holds at any size. */}
      {(blocked || marker === 'lock') && marker !== 'warning' && (
        <View
          style={[
            styles.lockBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              right: badgeInset,
              bottom: badgeInset,
            },
          ]}
        >
          <Lock s={badgeSize * 0.56} c="#FFFFFF" w={2.6} />
        </View>
      )}

      {marker === 'warning' && (
        <View
          style={[
            styles.lockBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              right: badgeInset,
              bottom: badgeInset,
              backgroundColor: OVER_COLOR,
            },
          ]}
        >
          <Text style={[styles.warningMark, { fontSize: badgeSize * 0.62 }]}>!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: F.serifSemiBold },
  warningMark: { fontFamily: F.sansBold, color: '#FFFFFF', includeFontPadding: false },
  lockBadge: {
    position: 'absolute',
    backgroundColor: BLOCKED_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFDFD',
  },
});
