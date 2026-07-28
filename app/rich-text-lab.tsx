import React from 'react';
import { Redirect } from 'expo-router';
import { isNativeRichTextEditorEnabled } from '@/components/shared/rich-text/native-rich-text-feature';
import { RichTextLabView } from '@/components/shared/rich-text/rich-text-lab-view';

export default function RichTextLabRoute() {
  const nativeEditorEnabled = isNativeRichTextEditorEnabled();
  if (!__DEV__ && !nativeEditorEnabled) return <Redirect href="/" />;
  return <RichTextLabView nativeEditorEnabled={nativeEditorEnabled} />;
}
