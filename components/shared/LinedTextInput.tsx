import React, { useMemo, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputContentSizeChangeEventData,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { C, F } from '@/constants/tokens';
import { TextSelection } from './TextFormatToolbar';

type LinedTextInputProps = Omit<TextInputProps, 'style' | 'multiline' | 'value' | 'onChangeText' | 'selection' | 'onSelectionChange'> & {
  value: string;
  onChangeText: (value: string) => void;
  selection?: TextSelection;
  onSelectionChange?: (selection: TextSelection) => void;
  minLines?: number;
  lineHeight?: number;
  wrapStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  lineColor?: string;
};

export const LinedTextInput = React.forwardRef<TextInput, LinedTextInputProps>(function LinedTextInput({
  value,
  onChangeText,
  selection,
  onSelectionChange,
  minLines = 4,
  lineHeight = 31,
  wrapStyle,
  inputStyle,
  lineColor = 'rgba(197,160,89,0.11)',
  onContentSizeChange,
  ...props
}: LinedTextInputProps, ref) {
  const minHeight = minLines * lineHeight;
  const [contentHeight, setContentHeight] = useState(minHeight);
  // Math.round avoids rounding up on sub-pixel heights (e.g. 33.5px → 2 lines)
  const height = Math.max(minHeight, Math.round(contentHeight / lineHeight) * lineHeight);

  const lines = useMemo(() => {
    const count = Math.max(minLines, Math.ceil(height / lineHeight));
    return Array.from({ length: count + 1 }, (_, index) => index);
  }, [height, lineHeight, minLines]);

  const handleContentSizeChange = (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    setContentHeight(Math.max(minHeight, event.nativeEvent.contentSize.height));
    onContentSizeChange?.(event);
  };

  return (
    <View style={[styles.wrap, { minHeight: height }, wrapStyle]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {lines.map(line => (
          <View
            key={line}
            style={[
              styles.line,
              {
                top: (line + 1) * lineHeight - 1,
                backgroundColor: lineColor,
              },
            ]}
          />
        ))}
      </View>
      <TextInput
        ref={ref}
        {...props}
        value={value}
        onChangeText={onChangeText}
        selection={selection}
        onSelectionChange={event => onSelectionChange?.(event.nativeEvent.selection)}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        onContentSizeChange={handleContentSizeChange}
        style={[
          styles.input,
          {
            minHeight,
            height,
            lineHeight,
          },
          inputStyle,
        ]}
      />
    </View>
  );
});

LinedTextInput.displayName = 'LinedTextInput';

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  input: {
    padding: 0,
    fontFamily: F.serif,
    fontSize: 19,
    color: C.text,
  },
});
