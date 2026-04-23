import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle, Text } from 'react-native';
import WebView from 'react-native-webview';
import { F, C } from '@/constants/tokens';

export type RichTextEditorRef = {
  bold: () => void;
  italic: () => void;
  underline: () => void;
  bulletList: () => void;
  orderedList: () => void;
  focus: () => void;
};

type Props = {
  initialHTML?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  backgroundColor?: string;
  color?: string;
  accentColor?: string;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
};

function buildEditorHTML(opts: {
  initialHTML: string;
  placeholder: string;
  backgroundColor: string;
  color: string;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      margin: 0; padding: 0;
      background: ${opts.backgroundColor};
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      line-height: 1.7;
      color: ${opts.color};
    }
    #editor {
      min-height: 300px;
      padding: 12px 0 40px 0;
      outline: none;
      word-wrap: break-word;
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
    contenteditable="true"
    data-placeholder="${opts.placeholder.replace(/"/g, '&quot;')}"
  >${opts.initialHTML}</div>
  <script>
    var editor = document.getElementById('editor');
    var lastHTML = editor.innerHTML;

    function notifyChange() {
      var html = editor.innerHTML;
      if (html !== lastHTML) {
        lastHTML = html;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'change', html: html }));
      }
    }

    editor.addEventListener('input', notifyChange);
    editor.addEventListener('keyup', notifyChange);

    function execCmd(cmd, value) {
      editor.focus();
      document.execCommand(cmd, false, value || null);
      notifyChange();
    }

    function setContent(html) {
      editor.innerHTML = html;
      lastHTML = html;
    }

    // Notify height changes so WebView can grow
    function notifyHeight() {
      var h = document.body.scrollHeight;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
    }
    var ro = new ResizeObserver(notifyHeight);
    ro.observe(document.body);
  </script>
</body>
</html>`;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(function RichTextEditor(
  {
    initialHTML = '',
    onChange,
    placeholder = 'Write here...',
    backgroundColor = '#FFFFFF',
    color = '#3D3229',
    accentColor = '#C5A059',
    minHeight = 320,
    style,
  },
  ref,
) {
  const webViewRef = useRef<WebView>(null);

  const inject = (cmd: string, value?: string) => {
    const script = `execCmd(${JSON.stringify(cmd)}${value ? `, ${JSON.stringify(value)}` : ''}); true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  useImperativeHandle(ref, () => ({
    bold:        () => inject('bold'),
    italic:      () => inject('italic'),
    underline:   () => inject('underline'),
    bulletList:  () => inject('insertUnorderedList'),
    orderedList: () => inject('insertOrderedList'),
    focus:       () => webViewRef.current?.injectJavaScript('editor.focus(); true;'),
  }));

  const html = buildEditorHTML({ initialHTML, placeholder, backgroundColor, color });

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html }}
      style={[{ minHeight, backgroundColor }, style]}
      scrollEnabled={false}
      keyboardDisplayRequiresUserAction={false}
      showsVerticalScrollIndicator={false}
      onMessage={event => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === 'change') onChange(msg.html);
        } catch { /* ignore */ }
      }}
    />
  );
});

type ToolbarProps = {
  editorRef: React.RefObject<RichTextEditorRef | null>;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function RichToolbar({ editorRef, accentColor = '#C5A059', style }: ToolbarProps) {
  const btn = (label: string, onPress: () => void, labelStyle?: object) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={tb.button}
    >
      <Text style={[tb.label, labelStyle]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[tb.wrap, style]}>
      {btn('B',  () => editorRef.current?.bold(),        { fontFamily: F.serifBold,        fontSize: 15 })}
      {btn('I',  () => editorRef.current?.italic(),      { fontFamily: F.serifMediumItalic, fontSize: 16 })}
      {btn('U',  () => editorRef.current?.underline(),   { textDecorationLine: 'underline' })}
      <View style={tb.sep} />
      <TouchableOpacity onPress={() => editorRef.current?.bulletList()}  activeOpacity={0.72} style={tb.button}>
        <BulletGlyph />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => editorRef.current?.orderedList()} activeOpacity={0.72} style={tb.button}>
        <NumberedGlyph />
      </TouchableOpacity>
    </View>
  );
}

function BulletGlyph() {
  return (
    <View style={{ gap: 4 }}>
      {[0,1,2].map(i => (
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
      {[1,2,3].map(n => (
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
  label: {
    fontFamily: F.sansBold,
    fontSize: 14,
    color: C.textSecondary,
  },
  sep: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
});
