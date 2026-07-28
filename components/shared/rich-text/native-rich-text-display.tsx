import React, { useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  EnrichedTextInput,
  type EnrichedTextInputProps,
} from 'react-native-enriched-html';
import { C, F } from '@/constants/tokens';
import { canonicalizeRichTextHtml } from '@/components/shared/rich-text/rich-text-html';

export type NativeRichTextDisplayProps = {
  html?: string;
  backgroundColor?: string;
  color?: string;
  minHeight?: number;
  selectable?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Web-only development fallback. Production native builds resolve the
 * `.native.tsx` sibling and render `EnrichedText`. The package does not export
 * `EnrichedText` on web, so its web editor is used in non-editable mode to
 * keep visual preflights free of the legacy WebView fallback message.
 */
export function NativeRichTextDisplay({
  html = '',
  backgroundColor = '#FFFFFF',
  color = C.text,
  minHeight = 0,
  style,
}: NativeRichTextDisplayProps) {
  const canonicalHtml = useMemo(() => canonicalizeRichTextHtml(html), [html]);
  const textStyle = useMemo<NonNullable<EnrichedTextInputProps['style']>>(() => ({
    minHeight,
    backgroundColor,
    color,
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 28,
    paddingHorizontal: 13,
    paddingVertical: 13,
  }), [backgroundColor, color, minHeight]);

  return (
    <View style={[{ minHeight, backgroundColor }, style]}>
      <EnrichedTextInput
        key={canonicalHtml}
        defaultValue={canonicalHtml}
        editable={false}
        scrollEnabled={false}
        allowFontScaling
        linkRegex={null}
        useHtmlNormalizer={false}
        style={textStyle}
        htmlStyle={{
          ul: { bulletColor: color, bulletSize: 5, marginLeft: 20, gapWidth: 8 },
          ol: { markerColor: color, marginLeft: 20, gapWidth: 8 },
        }}
      />
    </View>
  );
}
