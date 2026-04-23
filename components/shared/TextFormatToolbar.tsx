import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, F } from '@/constants/tokens';

export type TextSelection = {
  start: number;
  end: number;
};

export type BlockFormat = { bold: boolean; italic: boolean; underline: boolean };

type ListAction = 'bulletList' | 'numberedList';

type TextFormatResult = {
  text: string;
  selection: TextSelection;
};

type TextFormatToolbarProps = {
  value: string;
  selection: TextSelection;
  onChangeText: (value: string) => void;
  onSelectionChange: (selection: TextSelection) => void;
  blockFormat?: BlockFormat;
  onToggleBlockFormat?: (format: keyof BlockFormat) => void;
  style?: StyleProp<ViewStyle>;
};

function clampSelection(selection: TextSelection, text: string): TextSelection {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(0, Math.min(selection.end, text.length));
  return start <= end ? { start, end } : { start: end, end: start };
}

function getLineRange(text: string, selection: TextSelection) {
  const { start, end } = clampSelection(selection, text);
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

function stripListPrefix(line: string) {
  return line.replace(/^(\s*)(?:[-*]|\d+\.)\s+/, '$1');
}

function applyListFormat(text: string, selection: TextSelection, ordered: boolean): TextFormatResult {
  const { lineStart, lineEnd } = getLineRange(text, selection);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.length ? block.split('\n') : [''];

  const formatted = lines.map((line, index) => {
    const cleaned = stripListPrefix(line);
    const indent = cleaned.match(/^\s*/)?.[0] ?? '';
    const body = cleaned.slice(indent.length);
    return ordered ? `${indent}${index + 1}. ${body}` : `${indent}- ${body}`;
  });

  const nextBlock = formatted.join('\n');
  const nextText = `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`;
  return { text: nextText, selection: { start: lineStart, end: lineStart + nextBlock.length } };
}

export function applyTextFormat(
  text: string,
  selection: TextSelection,
  action: ListAction,
): TextFormatResult {
  return applyListFormat(text, selection, action === 'numberedList');
}

export function TextFormatToolbar({
  value,
  selection,
  onChangeText,
  onSelectionChange,
  blockFormat,
  onToggleBlockFormat,
  style,
}: TextFormatToolbarProps) {
  const runList = (action: ListAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = applyListFormat(value, selection, action === 'numberedList');
    onChangeText(result.text);
    onSelectionChange(result.selection);
  };

  const toggleFmt = (format: keyof BlockFormat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleBlockFormat?.(format);
  };

  return (
    <View style={[styles.wrap, style]}>
      <FormatButton
        label="B"
        onPress={() => toggleFmt('bold')}
        textStyle={styles.boldText}
        active={blockFormat?.bold}
      />
      <FormatButton
        label="I"
        onPress={() => toggleFmt('italic')}
        textStyle={styles.italicText}
        active={blockFormat?.italic}
      />
      <FormatButton
        label="U"
        onPress={() => toggleFmt('underline')}
        textStyle={styles.underlineText}
        active={blockFormat?.underline}
      />
      <View style={styles.separator} />
      <FormatButton onPress={() => runList('bulletList')}>
        <BulletListGlyph />
      </FormatButton>
      <FormatButton onPress={() => runList('numberedList')}>
        <NumberedListGlyph />
      </FormatButton>
    </View>
  );
}

function FormatButton({
  label,
  children,
  onPress,
  textStyle,
  active,
}: {
  label?: string;
  children?: ReactNode;
  onPress: () => void;
  textStyle?: object;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.76}
      style={[styles.button, active && styles.buttonActive]}
    >
      {children ?? (
        <Text style={[styles.buttonText, textStyle, active && styles.buttonTextActive]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function BulletListGlyph() {
  return (
    <View style={styles.listGlyph}>
      {[0, 1, 2].map(i => (
        <View key={i} style={styles.glyphRow}>
          <View style={styles.bulletDot} />
          <View style={styles.glyphLine} />
        </View>
      ))}
    </View>
  );
}

function NumberedListGlyph() {
  return (
    <View style={styles.numberedGlyph}>
      {[1, 2, 3].map(n => (
        <View key={n} style={styles.glyphRow}>
          <Text style={styles.numberMark}>{n}.</Text>
          <View style={styles.glyphLine} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 42,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: 'rgba(255,255,255,0.86)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  button: {
    width: 34,
    height: 31,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: 'rgba(197,160,89,0.18)',
  },
  buttonText: {
    fontFamily: F.sansBold,
    fontSize: 14,
    color: C.textSecondary,
  },
  buttonTextActive: {
    color: '#C5A059',
  },
  boldText: {
    fontFamily: F.serifBold,
    fontSize: 15,
  },
  italicText: {
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
  },
  underlineText: {
    textDecorationLine: 'underline',
  },
  separator: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
  listGlyph: {
    width: 20,
    gap: 4,
  },
  numberedGlyph: {
    width: 22,
    gap: 3,
  },
  glyphRow: {
    height: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.textSecondary,
  },
  numberMark: {
    width: 9,
    fontFamily: F.sansBold,
    fontSize: 6.5,
    lineHeight: 8,
    color: C.textSecondary,
    textAlign: 'right',
  },
  glyphLine: {
    flex: 1,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: C.textSecondary,
  },
});
