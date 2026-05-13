import React, { ReactNode, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


export type TextSelection = { start: number; end: number };
export type InlineFormatAction = 'bold' | 'italic' | 'underline' | 'bulletList' | 'numberedList';

export type TextFormatResult = { text: string; selection: TextSelection };

type TextFormatToolbarProps = {
  value: string;
  selection: TextSelection;
  onChangeText: (value: string) => void;
  onSelectionChange: (selection: TextSelection) => void;
  style?: StyleProp<ViewStyle>;
};

const FORMAT_MARKERS: Record<'bold' | 'italic' | 'underline', { before: string; after: string }> = {
  bold:      { before: '**', after: '**' },
  italic:    { before: '*',  after: '*'  },
  underline: { before: '<u>', after: '</u>' },
};

function clampSel(sel: TextSelection, len: number): TextSelection {
  const s = Math.max(0, Math.min(sel.start, len));
  const e = Math.max(0, Math.min(sel.end, len));
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

function applyInlineFormat(
  text: string,
  selection: TextSelection,
  marker: { before: string; after: string },
): TextFormatResult {
  const { start, end } = clampSel(selection, text.length);
  const selected = text.slice(start, end);
  const nextText = `${text.slice(0, start)}${marker.before}${selected}${marker.after}${text.slice(end)}`;
  const nextStart = start + marker.before.length;
  return { text: nextText, selection: { start: nextStart, end: nextStart + selected.length } };
}

function getLineRange(text: string, sel: TextSelection) {
  const { start, end } = clampSel(sel, text.length);
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

function stripListPrefix(line: string) {
  return line.replace(/^(\s*)(?:[-*]|\d+\.)\s+/, '$1');
}

function applyListFormat(text: string, sel: TextSelection, ordered: boolean): TextFormatResult {
  const { lineStart, lineEnd } = getLineRange(text, sel);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.length ? block.split('\n') : [''];
  const formatted = lines.map((line, i) => {
    const cleaned = stripListPrefix(line);
    const indent = cleaned.match(/^\s*/)?.[0] ?? '';
    const body = cleaned.slice(indent.length);
    return ordered ? `${indent}${i + 1}. ${body}` : `${indent}- ${body}`;
  });
  const nextBlock = formatted.join('\n');
  const nextText = `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`;
  return { text: nextText, selection: { start: lineStart, end: lineStart + nextBlock.length } };
}

export function applyTextFormat(
  text: string,
  selection: TextSelection,
  action: InlineFormatAction,
): TextFormatResult {
  if (action === 'bulletList')   return applyListFormat(text, selection, false);
  if (action === 'numberedList') return applyListFormat(text, selection, true);
  return applyInlineFormat(text, selection, FORMAT_MARKERS[action]);
}

// Detect whether cursor sits inside a markdown span
function detectActiveFormats(text: string, sel: TextSelection) {
  const pos = sel.start;
  let bold = false, italic = false, underline = false;

  const boldRe = /\*\*(?:[^*]|\*(?!\*))+\*\*/g;
  const italicRe = /(?<!\*)\*(?:[^*])+\*(?!\*)/g;
  const underlineRe = /<u>(?:[^<])+<\/u>/g;

  let m: RegExpExecArray | null;
  while ((m = boldRe.exec(text)) !== null) {
    if (pos > m.index && pos <= m.index + m[0].length) { bold = true; break; }
  }
  while ((m = italicRe.exec(text)) !== null) {
    if (pos > m.index && pos <= m.index + m[0].length) { italic = true; break; }
  }
  while ((m = underlineRe.exec(text)) !== null) {
    if (pos > m.index && pos <= m.index + m[0].length) { underline = true; break; }
  }
  return { bold, italic, underline };
}

export function TextFormatToolbar({
  value,
  selection,
  onChangeText,
  onSelectionChange,
  style,
}: TextFormatToolbarProps) {
  const active = useMemo(() => detectActiveFormats(value, selection), [value, selection]);

  const run = (action: InlineFormatAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = applyTextFormat(value, selection, action);
    onChangeText(result.text);
    onSelectionChange(result.selection);
  };

  return (
    <View style={[styles.wrap, style]}>
      <FormatButton label="B" onPress={() => run('bold')}      textStyle={styles.boldText}      active={active.bold} />
      <FormatButton label="I" onPress={() => run('italic')}    textStyle={styles.italicText}    active={active.italic} />
      <FormatButton label="U" onPress={() => run('underline')} textStyle={styles.underlineText} active={active.underline} />
      <View style={styles.separator} />
      <FormatButton onPress={() => run('bulletList')}>
        <BulletListGlyph />
      </FormatButton>
      <FormatButton onPress={() => run('numberedList')}>
        <NumberedListGlyph />
      </FormatButton>
    </View>
  );
}

function FormatButton({
  label, children, onPress, textStyle, active,
}: {
  label?: string; children?: ReactNode; onPress: () => void; textStyle?: object; active?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.76} style={[styles.button, active && styles.buttonActive]}>
      {children ?? <Text style={[styles.buttonText, textStyle, active && styles.buttonTextActive]}>{label}</Text>}
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
  boldText:      { fontFamily: F.serifBold, fontSize: 15 },
  italicText:    { fontFamily: F.serifMediumItalic, fontSize: 16 },
  underlineText: { textDecorationLine: 'underline' },
  separator: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
  listGlyph:     { width: 20, gap: 4 },
  numberedGlyph: { width: 22, gap: 3 },
  glyphRow:      { height: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  bulletDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: C.textSecondary },
  numberMark:    { width: 9, fontFamily: F.sansBold, fontSize: 6.5, lineHeight: 8, color: C.textSecondary, textAlign: 'right' },
  glyphLine:     { flex: 1, height: 1.5, borderRadius: 1, backgroundColor: C.textSecondary },
});
