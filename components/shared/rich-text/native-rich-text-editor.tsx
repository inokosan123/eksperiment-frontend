import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import type {
  EnrichedTextInputInstance,
  EnrichedTextInputProps,
  OnChangeStateEvent,
} from 'react-native-enriched-html';
import { C, F } from '@/constants/tokens';
import { useReadableFontScale } from '@/components/shared/typographyScale';
import {
  canonicalizeRichTextHtml,
  normalizeNativeRichTextPlainText,
  richTextToNativePlainText,
  toNativeRichTextTransportHtml,
} from '@/components/shared/rich-text/rich-text-html';
import { isNativeRichTextEditorEnabled } from '@/components/shared/rich-text/native-rich-text-feature';
import { useRichTextEditorActions } from '@/components/shared/rich-text/rich-text-editor-provider';
import type {
  NativeRichTextEditorRef,
  RichTextFormatState,
} from '@/components/shared/rich-text/rich-text-types';
import {
  recordRichTextEditorFocus,
  recordRichTextEditorRender,
} from '@/components/shared/rich-text/rich-text-diagnostics';
import {
  consumeExpectedRichTextPlainTextEcho,
  enqueueExpectedRichTextPlainTextEcho,
  runRichTextMutation,
} from '@/components/shared/rich-text/rich-text-mutation';

type EnrichedModule = typeof import('react-native-enriched-html');

export type NativeRichTextEditorProps = {
  editorId: string;
  initialHTML?: string;
  contentKey?: string | number;
  placeholder?: string;
  backgroundColor?: string;
  color?: string;
  editable?: boolean;
  autoHeight?: boolean;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
  onDirty?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

function toFormatState(state: OnChangeStateEvent): RichTextFormatState {
  return {
    bold: state.bold.isActive,
    italic: state.italic.isActive,
    underline: state.underline.isActive,
    bulletList: state.unorderedList.isActive,
    orderedList: state.orderedList.isActive,
  };
}

function toEditorTransportValue(html: string) {
  const canonical = canonicalizeRichTextHtml(html);
  return process.env.EXPO_OS === 'web'
    ? canonical
    : toNativeRichTextTransportHtml(canonical);
}

export const NativeRichTextEditor = forwardRef<
  NativeRichTextEditorRef,
  NativeRichTextEditorProps
>(function NativeRichTextEditor({
  editorId,
  initialHTML = '',
  contentKey = 'initial',
  placeholder = 'Write here...',
  backgroundColor = '#FFFFFF',
  color = C.text,
  editable = true,
  autoHeight = false,
  minHeight = autoHeight ? 108 : 180,
  style,
  onDirty,
  onFocus,
  onBlur,
}, forwardedRef) {
  const readableScale = useReadableFontScale();
  if (!isNativeRichTextEditorEnabled()) {
    throw new Error('NativeRichTextEditor was rendered without a native development build');
  }

  // Keep the native package out of Expo Go's module-evaluation path. The EAS
  // native-build flag is checked before this component can be mounted.
  const { EnrichedTextInput } = useMemo<EnrichedModule>(() => (
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy native-module boundary for Expo Go
    require('react-native-enriched-html') as EnrichedModule
  ), []);
  const nativeRef = useRef<EnrichedTextInputInstance>(null);
  // Native `defaultValue` is applied during prop mounting and does not emit a
  // text-change event. Only imperative `setValue` calls enqueue an expected
  // echo; otherwise the first real user edit could be swallowed by a stale
  // initial expectation.
  const suppressedPlainTextRef = useRef<string[]>([]);
  const mountedContentKeyRef = useRef<string | number>(contentKey);
  const {
    registerEditor,
    focusEditor,
    blurEditor,
    updateFormats,
    markDirty,
  } = useRichTextEditorActions();

  const setNativeValue = useCallback((html: string) => {
    const canonical = canonicalizeRichTextHtml(html);
    suppressedPlainTextRef.current = enqueueExpectedRichTextPlainTextEcho(
      suppressedPlainTextRef.current,
      richTextToNativePlainText(canonical),
    );
    nativeRef.current?.setValue(toEditorTransportValue(canonical));
  }, []);

  const initialTransportValueRef = useRef<string | null>(null);
  if (initialTransportValueRef.current === null) {
    initialTransportValueRef.current = toEditorTransportValue(initialHTML);
  }

  const editorHandle = useMemo<NativeRichTextEditorRef>(() => {
    const getHTML = async () => canonicalizeRichTextHtml(
      await nativeRef.current?.getHTML() ?? '',
    );
    const markFormattingDirty = () => {
      markDirty(editorId);
      onDirty?.();
    };
    const runFormattingCommand = (
      command: 'toggleBold'
        | 'toggleItalic'
        | 'toggleUnderline'
        | 'toggleUnorderedList'
        | 'toggleOrderedList',
    ) => {
      const editor = nativeRef.current;
      if (!editor) return;
      runRichTextMutation(
        () => editor[command](),
        markFormattingDirty,
      );
    };

    return {
      bold: () => runFormattingCommand('toggleBold'),
      italic: () => runFormattingCommand('toggleItalic'),
      underline: () => runFormattingCommand('toggleUnderline'),
      bulletList: () => runFormattingCommand('toggleUnorderedList'),
      orderedList: () => runFormattingCommand('toggleOrderedList'),
      focus: () => nativeRef.current?.focus(),
      blur: () => nativeRef.current?.blur(),
      setHTML: (html, notifyDirty = true) => {
        setNativeValue(html);
        if (notifyDirty) {
          markDirty(editorId);
          onDirty?.();
        }
      },
      getHTML,
      flush: getHTML,
    };
  }, [editorId, markDirty, onDirty, setNativeValue]);
  const publicRef = useRef<NativeRichTextEditorRef>(editorHandle);
  publicRef.current = editorHandle;

  useImperativeHandle(forwardedRef, () => editorHandle, [editorHandle]);

  useEffect(() => {
    recordRichTextEditorRender(editorId);
  });

  useEffect(() => registerEditor(editorId, { ref: publicRef }), [editorId, registerEditor]);

  useEffect(() => {
    if (mountedContentKeyRef.current === contentKey) return;
    mountedContentKeyRef.current = contentKey;
    setNativeValue(initialHTML);
  }, [contentKey, initialHTML, setNativeValue]);

  const editorStyle = useMemo<NonNullable<EnrichedTextInputProps['style']>>(() => ({
    minHeight,
    backgroundColor,
    color,
    fontFamily: F.serif,
    fontSize: 17 * readableScale,
    lineHeight: 28 * readableScale,
    paddingHorizontal: 13,
    paddingVertical: 13,
  }), [backgroundColor, color, minHeight, readableScale]);

  return (
    <View style={[{ minHeight, backgroundColor }, style]}>
      <EnrichedTextInput
        ref={nativeRef}
        defaultValue={initialTransportValueRef.current}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor="#B9B2A9"
        cursorColor={C.gold}
        selectionColor="rgba(197,160,89,0.28)"
        autoCapitalize="sentences"
        autoFocus={false}
        submitBehavior="newline"
        scrollEnabled={!autoHeight}
        allowFontScaling={false}
        linkRegex={null}
        useHtmlNormalizer={false}
        style={editorStyle}
        htmlStyle={{
          ul: { bulletColor: color, bulletSize: 5 * readableScale, marginLeft: 20 * readableScale, gapWidth: 8 * readableScale },
          ol: { markerColor: color, marginLeft: 20 * readableScale, gapWidth: 8 * readableScale },
        }}
        onChangeText={event => {
          const plainText = event.nativeEvent.value;
          const comparablePlainText = normalizeNativeRichTextPlainText(plainText);
          const echo = consumeExpectedRichTextPlainTextEcho(
            suppressedPlainTextRef.current,
            comparablePlainText,
          );
          suppressedPlainTextRef.current = echo.remaining;
          if (echo.matched) return;
          markDirty(editorId);
          onDirty?.();
        }}
        onChangeState={event => updateFormats(editorId, toFormatState(event.nativeEvent))}
        onFocus={() => {
          recordRichTextEditorFocus(editorId);
          focusEditor(editorId);
          onFocus?.();
        }}
        onBlur={() => {
          blurEditor(editorId);
          onBlur?.();
        }}
      />
    </View>
  );
});
