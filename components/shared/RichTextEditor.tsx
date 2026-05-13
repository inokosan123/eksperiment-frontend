import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, Text } from 'react-native';
import WebView from 'react-native-webview';
import { F, C } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


export type RichTextEditorRef = {
  bold: () => void;
  italic: () => void;
  underline: () => void;
  bulletList: () => void;
  orderedList: () => void;
  focus: () => void;
};

export type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type Props = {
  initialHTML?: string;
  onChange: (html: string) => void;
  onFormatChange?: (fmt: FormatState) => void;
  placeholder?: string;
  backgroundColor?: string;
  color?: string;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
};

function buildEditorHTML(opts: {
  initialHTML: string;
  placeholder: string;
  backgroundColor: string;
  color: string;
  editable: boolean;
}) {
  // Built once on mount — never rebuilt during editing
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; padding: 0; background: ${opts.backgroundColor}; }
    #editor {
      min-height: 280px;
      padding: 12px 0 60px 0;
      outline: none;
      word-wrap: break-word;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      line-height: 1.7;
      color: ${opts.color};
      -webkit-user-select: text;
      user-select: text;
    }
    #editor:empty:before {
      content: attr(data-placeholder);
      color: #CFCAC2;
      pointer-events: none;
    }
    ul { padding-left: 22px; margin: 4px 0; }
    ol { padding-left: 22px; margin: 4px 0; }
    li { margin: 2px 0; }
  </style>
</head>
<body>
  <div
    id="editor"
    contenteditable="${opts.editable ? 'true' : 'false'}"
    data-placeholder="${opts.placeholder.replace(/"/g, '&quot;')}"
  >${opts.initialHTML}</div>
  <script>
    var editor = document.getElementById('editor');

    function post(obj) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }

    // Scroll to keep cursor visible above keyboard
    function scrollToCursor() {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.height === 0) return;
      var cursorBottom = rect.bottom + window.scrollY;
      var viewBottom = window.scrollY + window.innerHeight - 20;
      if (cursorBottom > viewBottom) {
        window.scrollTo(0, cursorBottom - window.innerHeight + 60);
      }
    }

    // Notify content changes + scroll cursor into view
    editor.addEventListener('input', function() {
      scrollToCursor();
      post({ type: 'change', html: editor.innerHTML });
    });

    // Notify format state on every selection change
    document.addEventListener('selectionchange', function() {
      scrollToCursor();
      post({
        type: 'fmt',
        bold:      document.queryCommandState('bold'),
        italic:    document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    });

    function execCmd(cmd) {
      document.execCommand(cmd, false, null);
      editor.focus();
      post({ type: 'change', html: editor.innerHTML });
      post({
        type: 'fmt',
        bold:      document.queryCommandState('bold'),
        italic:    document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    }
  </script>
</body>
</html>`;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(function RichTextEditor(
  {
    initialHTML = '',
    onChange,
    onFormatChange,
    placeholder = 'Write here...',
    backgroundColor = '#FFFFFF',
    color = '#3D3229',
    editable = true,
    style,
  },
  ref,
) {
  const webViewRef = useRef<WebView>(null);

  // Build source ONCE on mount — never update it.
  // Rebuilding source would reload the WebView and dismiss the keyboard on every keystroke.
  const sourceRef = useRef<{ html: string } | null>(null);
  if (!sourceRef.current) {
    sourceRef.current = {
      html: buildEditorHTML({ initialHTML, placeholder, backgroundColor, color, editable }),
    };
  }

  const inject = (cmd: string) => {
    webViewRef.current?.injectJavaScript(`execCmd(${JSON.stringify(cmd)}); true;`);
  };

  useImperativeHandle(ref, () => ({
    bold:        () => inject('bold'),
    italic:      () => inject('italic'),
    underline:   () => inject('underline'),
    bulletList:  () => inject('insertUnorderedList'),
    orderedList: () => inject('insertOrderedList'),
    focus:       () => webViewRef.current?.injectJavaScript('editor.focus(); true;'),
  }));

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={sourceRef.current}
      style={[{ flex: 1, backgroundColor }, style]}
      scrollEnabled
      keyboardDisplayRequiresUserAction={false}
      showsVerticalScrollIndicator={false}
      onMessage={event => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === 'change') onChange(msg.html);
          if (msg.type === 'fmt') {
            onFormatChange?.({ bold: msg.bold, italic: msg.italic, underline: msg.underline });
          }
        } catch { /* ignore */ }
      }}
    />
  );
});

// ─── Toolbar ─────────────────────────────────────────────────────────────────

type ToolbarProps = {
  editorRef: React.RefObject<RichTextEditorRef | null>;
  activeFormats?: FormatState;
  style?: StyleProp<ViewStyle>;
};

export function RichToolbar({ editorRef, activeFormats, style }: ToolbarProps) {
  const fmt = activeFormats ?? { bold: false, italic: false, underline: false };

  return (
    <View style={[tb.wrap, style]}>
      <FmtButton
        label="B"
        active={fmt.bold}
        labelStyle={{ fontFamily: F.serifBold, fontSize: 15 }}
        onPress={() => editorRef.current?.bold()}
      />
      <FmtButton
        label="I"
        active={fmt.italic}
        labelStyle={{ fontFamily: F.serifMediumItalic, fontSize: 16 }}
        onPress={() => editorRef.current?.italic()}
      />
      <FmtButton
        label="U"
        active={fmt.underline}
        labelStyle={{ textDecorationLine: 'underline' }}
        onPress={() => editorRef.current?.underline()}
      />
      <View style={tb.sep} />
      <FmtButton onPress={() => editorRef.current?.bulletList()}>
        <BulletGlyph />
      </FmtButton>
      <FmtButton onPress={() => editorRef.current?.orderedList()}>
        <NumberedGlyph />
      </FmtButton>
    </View>
  );
}

function FmtButton({
  label, children, onPress, active, labelStyle,
}: {
  label?: string;
  children?: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  labelStyle?: object;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={[tb.button, active && tb.buttonActive]}
    >
      {children ?? (
        <Text style={[tb.label, labelStyle, active && tb.labelActive]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function BulletGlyph() {
  return (
    <View style={{ gap: 4 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 5 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.textSecondary }} />
          <View style={{ width: 16, height: 1.5, borderRadius: 1, backgroundColor: C.textSecondary }} />
        </View>
      ))}
    </View>
  );
}

function NumberedGlyph() {
  return (
    <View style={{ gap: 3 }}>
      {[1, 2, 3].map(n => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 5 }}>
          <Text style={{ width: 9, fontFamily: F.sansBold, fontSize: 6.5, lineHeight: 8, color: C.textSecondary, textAlign: 'right' }}>{n}.</Text>
          <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: C.textSecondary }} />
        </View>
      ))}
    </View>
  );
}

const tb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 42,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: 'rgba(255,255,255,0.86)',
    paddingHorizontal: 8,
    paddingVertical: 5,
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
  label: {
    fontFamily: F.sansBold,
    fontSize: 14,
    color: C.textSecondary,
  },
  labelActive: {
    color: '#C5A059',
  },
  sep: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
});
