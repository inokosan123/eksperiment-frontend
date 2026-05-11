import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { HABIT_SVG, HabitEmojiName } from './notoEmoji/habits';

type Props = {
  name: HabitEmojiName | string;
  size?: number;
};

// Static Noto Color Emoji renderer — used wherever we previously rendered
// system emoji glyphs in a Text node. Same visual on iOS + Android because
// we ship the SVG ourselves.
export function NotoEmoji({ name, size = 28 }: Props) {
  const xml = HABIT_SVG[name as HabitEmojiName];
  if (!xml) return null;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <SvgXml
        xml={xml}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
      />
    </View>
  );
}

export type { HabitEmojiName };
export const HABIT_EMOJI_NAMES = Object.keys(HABIT_SVG) as HabitEmojiName[];

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
