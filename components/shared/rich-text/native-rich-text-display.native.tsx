import React, { useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import type { EnrichedTextProps } from 'react-native-enriched-html';
import { C, F } from '@/constants/tokens';
import { toNativeRichTextTransportHtml } from '@/components/shared/rich-text/rich-text-html';
import { isNativeRichTextEditorEnabled } from '@/components/shared/rich-text/native-rich-text-feature';

type EnrichedModule = typeof import('react-native-enriched-html');

export type NativeRichTextDisplayProps = {
  html?: string;
  backgroundColor?: string;
  color?: string;
  minHeight?: number;
  selectable?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function NativeRichTextDisplay({
  html = '',
  backgroundColor = '#FFFFFF',
  color = C.text,
  minHeight = 0,
  selectable = true,
  style,
}: NativeRichTextDisplayProps) {
  if (!isNativeRichTextEditorEnabled()) {
    throw new Error('NativeRichTextDisplay was rendered without a native development build');
  }

  // Keep the package out of Expo Go's module-evaluation path. Metro resolves
  // this file for native platforms even while the legacy feature flag is off.
  const { EnrichedText } = useMemo<EnrichedModule>(() => (
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy native-module boundary for Expo Go
    require('react-native-enriched-html') as EnrichedModule
  ), []);
  const transportHtml = useMemo(
    () => toNativeRichTextTransportHtml(html),
    [html],
  );
  const textStyle = useMemo<NonNullable<EnrichedTextProps['style']>>(() => ({
    color,
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 28,
    paddingHorizontal: 13,
    paddingVertical: 13,
  }), [color]);

  return (
    <View style={[{ minHeight, backgroundColor }, style]}>
      <EnrichedText
        style={textStyle}
        htmlStyle={{
          ul: { bulletColor: color, bulletSize: 5, marginLeft: 20, gapWidth: 8 },
          ol: { markerColor: color, marginLeft: 20, gapWidth: 8 },
        }}
        useHtmlNormalizer={false}
        selectable={selectable}
        selectionColor="rgba(197,160,89,0.28)"
        allowFontScaling
      >
        {transportHtml}
      </EnrichedText>
    </View>
  );
}
