import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import { C, F } from '@/constants/tokens';
import { ChevronDown } from '@/components/icons/Icons';
import { useRichTextEditorCoordinator } from '@/components/shared/rich-text/rich-text-editor-provider';
import { recordRichTextKeyboardVisible } from '@/components/shared/rich-text/rich-text-diagnostics';
import { getNativeRichTextKeyboardController } from '@/components/shared/rich-text/native-rich-text-keyboard-runtime';
import { shouldClearBlurredRichTextEditor } from '@/components/shared/rich-text/rich-text-toolbar-state';

type FormatCommand = 'bold' | 'italic' | 'underline' | 'bulletList' | 'orderedList';

function ListGlyph({ ordered, color }: { ordered?: boolean; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="9" y1="6" x2="21" y2="6" />
      <Line x1="9" y1="12" x2="21" y2="12" />
      <Line x1="9" y1="18" x2="21" y2="18" />
      {ordered ? (
        <>
          <Path d="M3.5 5.3h1.2v3" />
          <Path d="M3.4 14.2c.3-.5.8-.8 1.3-.8.8 0 1.3.5 1.3 1.1 0 1-1.3 1.5-2.5 2.8H6" />
        </>
      ) : (
        <>
          <Line x1="4.5" y1="6" x2="4.51" y2="6" />
          <Line x1="4.5" y1="12" x2="4.51" y2="12" />
          <Line x1="4.5" y1="18" x2="4.51" y2="18" />
        </>
      )}
    </Svg>
  );
}

function ToolbarButton({
  label,
  command,
  active,
  children,
}: {
  label: string;
  command: FormatCommand;
  active: boolean;
  children: React.ReactNode;
}) {
  const { runActiveCommand } = useRichTextEditorCoordinator();
  const foreground = active ? C.gold : C.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      focusable={false}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        runActiveCommand(command);
      }}
      style={({ pressed }) => [
        styles.control,
        active && styles.controlActive,
        pressed && styles.controlPressed,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[
          styles.controlText,
          command === 'italic' && styles.italic,
          command === 'underline' && styles.underline,
          { color: foreground },
        ]}>
          {children}
        </Text>
      ) : children}
    </Pressable>
  );
}

export function RichTextKeyboardToolbar() {
  const {
    KeyboardEvents,
    KeyboardStickyView,
    useKeyboardState,
  } = getNativeRichTextKeyboardController();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState(state => state.isVisible);
  const keyboardClosingRef = useRef(false);
  const {
    activeEditor,
    clearBlurredEditor,
    dismissActiveEditor,
  } = useRichTextEditorCoordinator();

  useEffect(() => {
    const willShow = KeyboardEvents.addListener('keyboardWillShow', () => {
      keyboardClosingRef.current = false;
    });
    const didShow = KeyboardEvents.addListener('keyboardDidShow', () => {
      keyboardClosingRef.current = false;
    });
    const willHide = KeyboardEvents.addListener('keyboardWillHide', () => {
      keyboardClosingRef.current = true;
    });

    return () => {
      willShow.remove();
      didShow.remove();
      willHide.remove();
    };
  }, [KeyboardEvents]);

  useEffect(() => {
    if (!keyboardVisible || !activeEditor) return;
    recordRichTextKeyboardVisible(activeEditor.id);
  }, [activeEditor, keyboardVisible]);

  useEffect(() => {
    if (!activeEditor || activeEditor.focused) return;
    const editorId = activeEditor.id;
    const timeout = setTimeout(() => {
      // During a real keyboard dismissal the sticky view must remain mounted
      // until `keyboardDidHide` so it travels down with the keyboard. If the
      // keyboard stays open, focus moved to a normal TextInput and the rich
      // toolbar must leave immediately.
      if (!shouldClearBlurredRichTextEditor({
        keyboardVisible,
        keyboardClosing: keyboardClosingRef.current,
      })) return;
      clearBlurredEditor(editorId);
    }, keyboardVisible ? 120 : 90);
    return () => clearTimeout(timeout);
  }, [activeEditor, clearBlurredEditor, keyboardVisible]);

  if (!activeEditor) return null;

  const formats = activeEditor.formats;

  return (
    <KeyboardStickyView
      pointerEvents="box-none"
      offset={{ closed: -insets.bottom, opened: 0 }}
      style={styles.sticky}
    >
      <View style={styles.toolbar}>
        <ToolbarButton label="Bold" command="bold" active={formats.bold}>B</ToolbarButton>
        <ToolbarButton label="Italic" command="italic" active={formats.italic}>I</ToolbarButton>
        <ToolbarButton label="Underline" command="underline" active={formats.underline}>U</ToolbarButton>
        <View style={styles.divider} />
        <ToolbarButton label="Bulleted list" command="bulletList" active={formats.bulletList}>
          <ListGlyph color={formats.bulletList ? C.gold : C.textSecondary} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" command="orderedList" active={formats.orderedList}>
          <ListGlyph ordered color={formats.orderedList ? C.gold : C.textSecondary} />
        </ToolbarButton>
        <View style={styles.flex} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
          focusable={false}
          onPress={dismissActiveEditor}
          style={({ pressed }) => [styles.done, pressed && styles.controlPressed]}
        >
          <ChevronDown s={18} c={C.textSecondary} w={2.3} />
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  toolbar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 2,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(55,45,34,0.14)',
    backgroundColor: '#FFFCF7',
  },
  control: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: {
    backgroundColor: 'rgba(197,160,89,0.14)',
  },
  controlPressed: {
    opacity: 0.58,
    transform: [{ scale: 0.97 }],
  },
  controlText: {
    fontFamily: F.sansBold,
    fontSize: 17,
    lineHeight: 21,
  },
  italic: {
    fontFamily: F.serifMediumItalic,
    fontSize: 19,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    marginHorizontal: 3,
    backgroundColor: 'rgba(55,45,34,0.14)',
  },
  flex: {
    flex: 1,
    minWidth: 2,
  },
  done: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: 5,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 2,
  },
  doneText: {
    fontFamily: F.sansSemiBold,
    fontSize: 13,
    color: C.textSecondary,
  },
});
