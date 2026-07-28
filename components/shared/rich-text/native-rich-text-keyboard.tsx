import React, { forwardRef } from 'react';
import type { KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';
import type { ScrollView } from 'react-native';
import { isNativeRichTextEditorEnabled } from '@/components/shared/rich-text/native-rich-text-feature';
import { getNativeRichTextKeyboardController } from '@/components/shared/rich-text/native-rich-text-keyboard-runtime';

export function NativeRichTextKeyboardBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isNativeRichTextEditorEnabled()) return children;
  const { KeyboardProvider } = getNativeRichTextKeyboardController();
  return <KeyboardProvider preload={false}>{children}</KeyboardProvider>;
}

export const NativeRichTextKeyboardAwareScrollView = forwardRef<
  ScrollView,
  KeyboardAwareScrollViewProps
>(function NativeRichTextKeyboardAwareScrollView(props, ref) {
  const { KeyboardAwareScrollView } = getNativeRichTextKeyboardController();
  return <KeyboardAwareScrollView ref={ref} {...props} />;
});
