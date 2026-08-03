import React, { useMemo, useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { useReadableFontScale } from '@/components/shared/typographyScale';


type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type Block =
  | { type: 'p'; inlines: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] };

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
};

function decode(input: string) {
  return input.replace(/&(nbsp|amp|lt|gt|quot|#39|apos|rsquo|lsquo|rdquo|ldquo);/g, m => HTML_ENTITIES[m] ?? m);
}

function styleHasBold(style: string) {
  return /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
}
function styleHasItalic(style: string) {
  return /font-style\s*:\s*italic/i.test(style);
}
function styleHasUnderline(style: string) {
  return /text-decoration[^:]*:\s*[^;"]*underline/i.test(style);
}

function parseInline(html: string, format: Omit<Inline, 'text'> = {}): Inline[] {
  const out: Inline[] = [];
  // Match opening tag (with optional attributes) or closing tag for inline formatting elements.
  // div/p included as transparent passthrough so any block-level orphans left behind by
  // the block parser (e.g. when contenteditable produces nested same-tag wrappers) get
  // stripped instead of leaking into rendered text.
  const tagRegex = /<(\/?)(b|strong|i|em|u|span|div|p)(\s[^>]*)?>/i;
  let cursor = 0;

  while (cursor < html.length) {
    const slice = html.slice(cursor);
    const match = tagRegex.exec(slice);
    if (!match) {
      const text = decode(html.slice(cursor));
      if (text) out.push({ ...format, text });
      break;
    }

    const matchPos = cursor + match.index;
    if (matchPos > cursor) {
      const text = decode(html.slice(cursor, matchPos));
      if (text) out.push({ ...format, text });
    }

    const isClose = match[1] === '/';
    const tag = match[2].toLowerCase();
    const attrs = match[3] ?? '';

    if (isClose) {
      cursor = matchPos + match[0].length;
      continue;
    }

    // Find matching close tag (skip nested same-tag opens)
    const innerStart = matchPos + match[0].length;
    const closeRegex = new RegExp(`<(\\/?)${tag}(\\s[^>]*)?>`, 'gi');
    closeRegex.lastIndex = innerStart;
    let depth = 1;
    let closeAt = -1;
    let closeLen = 0;
    let cm: RegExpExecArray | null;
    while ((cm = closeRegex.exec(html)) !== null) {
      if (cm[1] === '/') {
        depth -= 1;
        if (depth === 0) { closeAt = cm.index; closeLen = cm[0].length; break; }
      } else {
        depth += 1;
      }
    }

    if (closeAt < 0) {
      // No closing tag — treat opening as text and continue from after it
      cursor = innerStart;
      continue;
    }

    const inner = html.slice(innerStart, closeAt);

    const next = { ...format };
    if (tag === 'b' || tag === 'strong') next.bold = true;
    if (tag === 'i' || tag === 'em') next.italic = true;
    if (tag === 'u') next.underline = true;
    // Inline style on span/u/b/i/etc — pick up bold/italic/underline if declared
    if (attrs) {
      const styleMatch = /style\s*=\s*"([^"]*)"/i.exec(attrs);
      if (styleMatch) {
        const style = styleMatch[1];
        if (styleHasBold(style)) next.bold = true;
        if (styleHasItalic(style)) next.italic = true;
        if (styleHasUnderline(style)) next.underline = true;
      }
    }

    out.push(...parseInline(inner, next));
    cursor = closeAt + closeLen;
  }

  return out;
}

function parseInlineWithBr(html: string): Inline[] {
  const normalised = html.replace(/<br\s*\/?>/gi, '\n');
  return parseInline(normalised);
}

// Recursively parse block-level content. Recurses into <p>/<div> wrappers so
// lists nested inside paragraph blocks (a common contenteditable pattern) are
// recognised as their own blocks rather than dumped through inline parsing.
function parseBlocks(html: string, depth = 0): Block[] {
  const blocks: Block[] = [];
  if (!html) return blocks;
  if (depth > 6) {
    // Safety cap; flatten remainder as a paragraph
    const inlines = parseInlineWithBr(html);
    if (inlines.length) blocks.push({ type: 'p', inlines });
    return blocks;
  }

  const blockRegex = /<(ul|ol|p|div)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null) {
    if (match.index > cursor) {
      const between = html.slice(cursor, match.index);
      if (between.trim()) {
        // Remaining inline-level content between blocks
        const inlines = parseInlineWithBr(between);
        if (inlines.length) blocks.push({ type: 'p', inlines });
      }
    }

    const tag = match[1].toLowerCase();
    const inner = match[2];

    if (tag === 'ul' || tag === 'ol') {
      const items: Inline[][] = [];
      const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRegex.exec(inner)) !== null) {
        items.push(parseInlineWithBr(liMatch[1]));
      }
      if (items.length > 0) blocks.push({ type: tag, items });
    } else {
      // <p> or <div> — recurse so nested <ul>/<ol> become real list blocks
      const innerHasBlock = /<(ul|ol|p|div)\b/i.test(inner);
      if (innerHasBlock) {
        const nested = parseBlocks(inner, depth + 1);
        blocks.push(...nested);
      } else {
        const inlines = parseInlineWithBr(inner);
        if (inlines.length > 0) blocks.push({ type: 'p', inlines });
        else blocks.push({ type: 'p', inlines: [{ text: '' }] });
      }
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < html.length) {
    const rest = html.slice(cursor);
    if (rest.trim()) {
      const inlines = parseInlineWithBr(rest);
      if (inlines.length > 0) blocks.push({ type: 'p', inlines });
    }
  }

  if (blocks.length === 0) {
    const plain = parseInlineWithBr(html);
    if (plain.length > 0) blocks.push({ type: 'p', inlines: plain });
  }

  return blocks;
}

export function parseRichComment(html: string): Block[] {
  return parseBlocks(html ?? '');
}

function renderInlines(inlines: Inline[], baseStyle: object) {
  return inlines.map((part, index) => {
    const style = [
      baseStyle,
      part.bold && { fontFamily: F.serifBold },
      part.italic && { fontStyle: 'italic' as const },
      part.underline && { textDecorationLine: 'underline' as const },
    ];
    return <Text key={index} style={style}>{part.text}</Text>;
  });
}

const FONT_SIZE = 16;
const LINE_HEIGHT = 23;
const DEFAULT_COLLAPSED_LINES = 6;

type Props = {
  html: string;
  color?: string;
  collapsedLines?: number;
  // Optional right-side content rendered next to the See more / See less toggle
  // (or alone if no truncation is needed). Useful for tucking action buttons
  // into the same bottom row.
  rightSlot?: React.ReactNode;
};

export default function RichCommentText({
  html,
  color = '#5C5752',
  collapsedLines = DEFAULT_COLLAPSED_LINES,
  rightSlot,
}: Props) {
  const readableScale = useReadableFontScale();
  const blocks = useMemo(() => parseRichComment(html ?? ''), [html]);
  const [expanded, setExpanded] = useState(false);
  const [needsTruncate, setNeedsTruncate] = useState<boolean | null>(null);

  // Pixel cap aligned to whole lines so truncation never slices a glyph
  const collapsedHeight = LINE_HEIGHT * readableScale * collapsedLines;
  const baseTextStyle = {
    fontFamily: F.serif,
    fontSize: FONT_SIZE * readableScale,
    lineHeight: LINE_HEIGHT * readableScale,
    color,
  };

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setExpanded(v => !v);
  };

  const renderBlocks = () => blocks.map((block, blockIndex) => {
    if (block.type === 'p') {
      return (
        <Text key={blockIndex} style={[s.paragraph, baseTextStyle]}>
          {renderInlines(block.inlines, {})}
        </Text>
      );
    }

    return (
      <View key={blockIndex} style={s.list}>
        {block.items.map((item, itemIndex) => (
          <View key={itemIndex} style={s.listItem}>
            <Text style={[s.listMarker, baseTextStyle]}>
              {block.type === 'ol' ? `${itemIndex + 1}.` : '•'}
            </Text>
            <Text style={[s.listContent, baseTextStyle]}>
              {renderInlines(item, {})}
            </Text>
          </View>
        ))}
      </View>
    );
  });

  const showTruncated = needsTruncate && !expanded;

  return (
    <View>
      {/* Hidden measurement copy — full height, invisible */}
      {needsTruncate === null && (
        <View
          style={s.measureWrap}
          pointerEvents="none"
          onLayout={e => {
            const h = e.nativeEvent.layout.height;
            setNeedsTruncate(h > collapsedHeight + 4);
          }}
        >
          {renderBlocks()}
        </View>
      )}

      <View style={[s.contentWrap, showTruncated && { maxHeight: collapsedHeight, overflow: 'hidden' }]}>
        {renderBlocks()}
      </View>

      {(needsTruncate || rightSlot) && (
        <View style={s.bottomRow}>
          {needsTruncate ? (
            <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={s.seeMore}>
              <Text style={[s.seeMoreText, { color }]}>{expanded ? 'See less' : 'See more'}</Text>
              <Text style={[s.seeMoreArrow, { color, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>
                {'›'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {rightSlot ? <View style={s.rightSlot}>{rightSlot}</View> : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  contentWrap: {},
  measureWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  paragraph: {},
  list: {},
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listMarker: { minWidth: 20, textAlign: 'right' },
  listContent: { flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  seeMore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeMoreText: { fontFamily: F.sansSemiBold, fontSize: 12, letterSpacing: 0.3 },
  seeMoreArrow: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 18 },
  rightSlot: { flexDirection: 'row', alignItems: 'center' },
});
