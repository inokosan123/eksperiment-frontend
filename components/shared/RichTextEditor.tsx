import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, Text } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
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
  blur: () => void;
  setHTML: (html: string, notifyChange?: boolean) => void;
  getHTML: () => Promise<string>;
};

export type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type Props = {
  initialHTML?: string;
  contentKey?: string | number;
  onChange: (html: string) => void;
  onFormatChange?: (fmt: FormatState) => void;
  placeholder?: string;
  backgroundColor?: string;
  color?: string;
  editable?: boolean;
  // When true, WebView grows to fit content (no internal scroll). Outer
  // page must handle keyboard. When false (default), WebView fills its
  // parent and scrolls internally.
  autoHeight?: boolean;
  // Fires with the cursor's absolute Y position on screen when it moves.
  // Used by the outer ScrollView (in autoHeight mode) to scroll the page
  // so the cursor stays visible above the keyboard.
  onCursorScreenY?: (screenY: number) => void;
  style?: StyleProp<ViewStyle>;
};

function buildEditorHTML(opts: {
  initialHTML: string;
  placeholder: string;
  backgroundColor: string;
  color: string;
  editable: boolean;
  autoHeight: boolean;
}) {
  // Built once on mount — never rebuilt during editing
  const scrollCss = opts.autoHeight
    ? 'overflow: hidden;'
    : 'min-height: 100vh; overflow-x: hidden;';
  const editorMinHeight = opts.autoHeight ? '80px' : '100vh';
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; padding: 0; background: ${opts.backgroundColor}; ${scrollCss} }
    #editor {
      min-height: ${editorMinHeight};
      padding: 14px 12px 36px 12px;
      outline: none;
      word-wrap: break-word;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 17px;
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

    // Report total content height back to React Native so the WebView
    // can grow to fit content (no internal scroll).
    var lastReported = 0;
    var heightTimer = null;
    function reportHeight() {
      var h = Math.ceil(document.documentElement.scrollHeight);
      if (h === lastReported) return;
      lastReported = h;
      post({ type: 'height', height: h });
    }
    function scheduleHeight() {
      if (heightTimer) clearTimeout(heightTimer);
      heightTimer = setTimeout(reportHeight, 16);
    }

    // Send current cursor Y position (relative to WebView top) so outer
    // page can scroll to keep cursor visible above keyboard.
    function postCursor() {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.height === 0 && rect.width === 0) return;
      post({ type: 'cursor', y: rect.bottom });
    }

    editor.addEventListener('input', function() {
      post({ type: 'change', html: editor.innerHTML });
      scheduleHeight();
      postCursor();
    });

    editor.addEventListener('focus', function() {
      setTimeout(postCursor, 60);
    });

    // Notify format state on every selection change
    document.addEventListener('selectionchange', function() {
      post({
        type: 'fmt',
        bold:      document.queryCommandState('bold'),
        italic:    document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
      postCursor();
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
      scheduleHeight();
    }

    function setEditorTheme(background, textColor) {
      document.documentElement.style.background = background;
      document.body.style.background = background;
      editor.style.background = background;
      editor.style.color = textColor;
    }

    // Initial measurement after layout
    setTimeout(reportHeight, 30);
    setTimeout(reportHeight, 200);

    // Watch for any layout shifts (font load, formatting toggles, etc.)
    if (window.ResizeObserver) {
      new ResizeObserver(scheduleHeight).observe(editor);
    }
  </script>
</body>
</html>`;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(function RichTextEditor(
  {
    initialHTML = '',
    contentKey,
    onChange,
    onFormatChange,
    placeholder = 'Write here...',
    backgroundColor = '#FFFFFF',
    color = '#3D3229',
    editable = true,
    autoHeight = false,
    onCursorScreenY,
    style,
  },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const wrapperRef = useRef<View>(null);
  const htmlRequestIdRef = useRef(0);
  const htmlResolversRef = useRef<Map<number, { resolve: (html: string) => void; reject: () => void }>>(new Map());
  const [contentHeight, setContentHeight] = useState(110);

  // Build source ONCE on mount — never update it.
  // Rebuilding source would reload the WebView and dismiss the keyboard on every keystroke.
  const sourceKey = contentKey ?? 'initial';
  const sourceRef = useRef<{ html: string } | null>(null);
  const sourceKeyRef = useRef<string | number | null>(null);
  if (!sourceRef.current || sourceKeyRef.current !== sourceKey) {
    sourceRef.current = {
      html: buildEditorHTML({ initialHTML, placeholder, backgroundColor, color, editable, autoHeight }),
    };
    sourceKeyRef.current = sourceKey;
  }

  const inject = (cmd: string) => {
    webViewRef.current?.injectJavaScript(`execCmd(${JSON.stringify(cmd)}); true;`);
  };

  const syncEditorTheme = () => {
    webViewRef.current?.injectJavaScript(`
      if (typeof setEditorTheme === 'function') {
        setEditorTheme(${JSON.stringify(backgroundColor)}, ${JSON.stringify(color)});
      } else {
        document.documentElement.style.background = ${JSON.stringify(backgroundColor)};
        document.body.style.background = ${JSON.stringify(backgroundColor)};
        var editorNode = document.getElementById('editor');
        if (editorNode) {
          editorNode.style.background = ${JSON.stringify(backgroundColor)};
          editorNode.style.color = ${JSON.stringify(color)};
        }
      }
      true;
    `);
  };

  useEffect(() => {
    syncEditorTheme();
  }, [backgroundColor, color]);

  useImperativeHandle(ref, () => ({
    bold:        () => inject('bold'),
    italic:      () => inject('italic'),
    underline:   () => inject('underline'),
    bulletList:  () => inject('insertUnorderedList'),
    orderedList: () => inject('insertOrderedList'),
    focus:       () => webViewRef.current?.injectJavaScript('editor.focus(); true;'),
    blur:        () => webViewRef.current?.injectJavaScript(`
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      editor.blur();
      window.getSelection()?.removeAllRanges();
      true;
    `),
    setHTML:     (html: string, notifyChange = true) => webViewRef.current?.injectJavaScript(`
      editor.innerHTML = ${JSON.stringify(html)};
      ${notifyChange ? "post({ type: 'change', html: editor.innerHTML });" : ''}
      scheduleHeight();
      true;
    `),
    getHTML:     () => new Promise((resolve, reject) => {
      const requestId = htmlRequestIdRef.current + 1;
      htmlRequestIdRef.current = requestId;
      htmlResolversRef.current.set(requestId, { resolve, reject });
      webViewRef.current?.injectJavaScript(`
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'html',
          requestId: ${requestId},
          html: editor.innerHTML,
        }));
        true;
      `);
      setTimeout(() => {
        const pending = htmlResolversRef.current.get(requestId);
        if (!pending) return;
        htmlResolversRef.current.delete(requestId);
        pending.reject();
      }, 250);
    }),
  }));

  return (
    <View
      ref={wrapperRef}
      style={
        autoHeight
          ? [{ height: contentHeight, backgroundColor, overflow: 'hidden' }, style]
          : [{ flex: 1, backgroundColor }, style]
      }
    >
      <WebView
        key={String(sourceKey)}
        ref={webViewRef}
        originWhitelist={['*']}
        source={sourceRef.current}
        style={{ flex: 1, backgroundColor }}
        scrollEnabled={!autoHeight}
        keyboardDisplayRequiresUserAction={false}
        showsVerticalScrollIndicator={false}
        onLoadEnd={syncEditorTheme}
        onMessage={event => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'change') onChange(msg.html);
            if (msg.type === 'html') {
              const pending = htmlResolversRef.current.get(msg.requestId);
              if (pending) {
                htmlResolversRef.current.delete(msg.requestId);
                pending.resolve(msg.html ?? '');
              }
            }
            if (msg.type === 'fmt') {
              onFormatChange?.({ bold: msg.bold, italic: msg.italic, underline: msg.underline });
            }
            if (msg.type === 'height' && autoHeight) {
              const next = Math.max(80, Math.ceil(msg.height));
              setContentHeight(prev => prev === next ? prev : next);
            }
            if (msg.type === 'cursor' && onCursorScreenY) {
              wrapperRef.current?.measureInWindow((_x, y) => {
                onCursorScreenY(y + msg.y);
              });
            }
          } catch { /* ignore */ }
        }}
      />
    </View>
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

function BulletGlyph({ color = C.textSecondary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="8" y1="6" x2="21" y2="6" />
      <Line x1="8" y1="12" x2="21" y2="12" />
      <Line x1="8" y1="18" x2="21" y2="18" />
      <Line x1="3.5" y1="6" x2="3.51" y2="6" />
      <Line x1="3.5" y1="12" x2="3.51" y2="12" />
      <Line x1="3.5" y1="18" x2="3.51" y2="18" />
    </Svg>
  );
}

function NumberedGlyph({ color = C.textSecondary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="10" y1="6" x2="21" y2="6" />
      <Line x1="10" y1="12" x2="21" y2="12" />
      <Line x1="10" y1="18" x2="21" y2="18" />
      <Path d="M4 6h1v4" />
      <Path d="M4 10h2" />
      <Path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </Svg>
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
