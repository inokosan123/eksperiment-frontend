import React, { forwardRef } from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import {
  MAX_READABLE_FONT_MULTIPLIER,
  MIN_READABLE_LINE_HEIGHT_RATIO,
  clampReadableFontScale,
  scaleReadableLineHeight,
  scaleReadableMetric,
} from '@/components/shared/typographyScalePolicy';

export {
  MAX_READABLE_FONT_MULTIPLIER,
  MIN_READABLE_LINE_HEIGHT_RATIO,
  clampReadableFontScale,
  scaleReadableLineHeight,
  scaleReadableMetric,
};

/**
 * Compatibility hook for geometry-coupled text. Release typography is fixed,
 * so every call site receives the authored 100% scale.
 */
export function useReadableFontScale(): number {
  return 1;
}

/**
 * Compatibility wrapper retained for existing call sites. It preserves the
 * authored style exactly and explicitly disables native font scaling.
 */
export const ReadableText = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  function ReadableText({ style, ...props }, ref) {
    return (
      <NativeText
        {...props}
        ref={ref}
        allowFontScaling={false}
        maxFontSizeMultiplier={1}
        style={style}
      />
    );
  },
);

/** TextInput counterpart used only for the approved long-form content fields. */
export const ReadableTextInput = forwardRef<
  React.ElementRef<typeof NativeTextInput>,
  TextInputProps
>(function ReadableTextInput({ style, ...props }, ref) {
  return (
    <NativeTextInput
      {...props}
      ref={ref}
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      style={style}
    />
  );
});
