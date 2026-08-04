import { StyleSheet, Text, View } from 'react-native';
import { X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';

// ── The ceremonial head ────────────────────────────────────────────────────
// The name, what it currently is, and a ruled diamond closing the head. The
// ground stays white and the colour arrives in ink alone — a tint spread
// across the top of a sheet reads as a stain, not as light, because a sheet
// IS the page rather than a lit object sitting on one.
//
// It is a NAMED export beside the default one, not a change to it: every other
// Focus sheet keeps the header it already has.
//
// The close is a stud in the sheet's own top-right curve, rimmed in the room's
// colour, rather than the grey circle a settings control would wear.
export function FocusCeremonialHead({
  title,
  meta,
  accent,
  onClose,
  minimumFontScale = 0.72,
}: {
  title: string;
  /**
   * One line, in the room's colour: what this thing currently is.
   *
   * Omit it on a sheet that scrolls, and render `FocusHeadMeta` as the first
   * child of the scroll instead. A pinned header should hold only what names
   * the sheet — the title, its rule and the close; the state is a reading of
   * the content, so it belongs to the content and should travel with it.
   */
  meta?: string;
  accent: string;
  onClose: () => void;
  minimumFontScale?: number;
}) {
  const rule = withAlpha(accent, 0.26);
  return (
    <View style={h.head}>
      <TouchableOpacity
        style={[h.close, { borderColor: withAlpha(accent, 0.34), shadowColor: accent }]}
        onPress={onClose}
        hitSlop={8}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <X s={15} c={accent} w={2} />
      </TouchableOpacity>

      {/* Padded clear of the stud on BOTH sides, so the name is centred on the
          sheet rather than on the space left over beside the button. */}
      <View style={h.copy}>
        <Text style={h.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={minimumFontScale}>
          {title}
        </Text>
      </View>

      {/* The rule breaks the name from everything under it. */}
      <View style={h.ornament}>
        <View style={[h.rule, { backgroundColor: rule }]} />
        <View style={[h.diamond, { backgroundColor: withAlpha(accent, 0.6) }]} />
        <View style={[h.rule, { backgroundColor: rule }]} />
      </View>

      {/* And the state is the first thing said beneath it — it belongs to what
          follows, not to the name, so it sits nearer the rule than the title
          does. The title, the rule, then the reading. */}
      {!!meta && <Text style={[h.meta, { color: accent }]} numberOfLines={1}>{meta}</Text>}
    </View>
  );
}

/**
 * The head's state line, for a sheet whose head is pinned above a scroll: put
 * this first inside the scroll so it scrolls away with the content it reads,
 * leaving only the title, its rule and the close fixed at the top.
 */
export function FocusHeadMeta({ meta, accent }: { meta: string; accent: string }) {
  return <Text style={[h.meta, h.metaScrolled, { color: accent }]} numberOfLines={1}>{meta}</Text>;
}

// Local so this file stays free of Focus-specific imports.
function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export const FocusSheetHandle = () => <View style={h.handle} />;

const h = StyleSheet.create({
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  head: { position: 'relative', marginTop: 12 },
  // Sits at the content's right edge, which the sheet's own padding puts on
  // the top-right curve.
  close: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 5,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDFE',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 1,
  },
  // 44 clears the 34pt stud on the right; the same on the left keeps the name
  // centred on the sheet instead of on what is left beside the button.
  //
  // The title sits LOW and close to its rule: 6 more below the handle than the
  // stud, then only 8 down to the ornament. It used to be 15 above the rule and
  // 9 below, which left the name marooned at the top of the sheet with a
  // divider under it. Title, rule and reading are one assembly, so they are
  // spaced like one.
  copy: { marginTop: 6, alignItems: 'center', paddingHorizontal: 44 },
  /**
   * ⚠ `alignSelf: 'stretch'` IS WHAT MAKES THE TITLE READABLE, and its
   * absence is why this name was arriving shrunk to a whisper.
   *
   * The parent centres its children, so without a stretch this Text is
   * laid out at its own SHRINK-TO-FIT width — and `adjustsFontSizeToFit`
   * then has a box barely wider than the glyphs to fit into, so it shrinks
   * the type toward `minimumFontScale` even though the full 29 would have
   * fitted the sheet with room to spare. Stretched, the fitting has the
   * whole measure to work with and only shrinks a name that genuinely
   * overruns; `textAlign` below still centres it.
   */
  title: {
    alignSelf: 'stretch',
    fontFamily: F.serifMedium,
    fontSize: 29,
    lineHeight: 33,
    letterSpacing: -0.4,
    color: C.text,
    textAlign: 'center',
  },
  // Set in the serif rather than in the app's caps kicker: caps under a serif
  // title read as a system label bolted to a name.
  meta: { marginTop: 9, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 19, textAlign: 'center' },
  // Inside a scroll the 9 comes from the scroll's own top padding, and the 6
  // makes up the difference to the 16 that used to sit under the head.
  metaScrolled: { marginTop: 0, marginBottom: 6 },
  // Inset rather than full-bleed: a rule running edge to edge is a divider
  // BETWEEN things, and this one belongs to the title above it. Stopping short
  // also keeps it clear of the stud.
  ornament: {
    marginTop: 8,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 9,
  },
  rule: { flex: 1, height: 1 },
  diamond: { width: 4.5, height: 4.5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
});

export default function FocusSheetHeader({
  title,
  kicker,
  subtitle,
  onClose,
  large = false,
  centered = false,
  leading,
}: {
  title: string;
  kicker?: string;
  subtitle?: string;
  onClose: () => void;
  large?: boolean;
  // Task-sheet grammar: close on the left, serif title centered, a hairline
  // under the whole header. Kicker and subtitle are not rendered.
  centered?: boolean;
  // A seal or emblem set before the copy, so a sheet about one object can
  // carry that object's face instead of repeating its name in a card below.
  leading?: React.ReactNode;
}) {
  if (centered) {
    return (
      <>
        <View style={s.centerHandle} />
        <View style={s.centerHeader}>
          <TouchableOpacity style={s.centerButton} onPress={onClose} hitSlop={8} activeOpacity={0.76}>
            <X s={20} c={C.textMuted} w={2.1} />
          </TouchableOpacity>
          <Text style={s.centerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{title}</Text>
          <View style={s.centerSpacer} />
        </View>
      </>
    );
  }
  return (
    <>
      <View style={s.handle} />
      <View style={[s.headerRow, large && s.headerRowLarge]}>
        {leading}
        <View style={s.copy}>
          {!!kicker && <Text style={[s.kicker, large && s.kickerLarge]} numberOfLines={1}>{kicker}</Text>}
          <Text style={[s.title, large && s.titleLarge]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>{title}</Text>
        </View>
        <TouchableOpacity style={[s.closeButton, large && s.closeButtonLarge]} onPress={onClose} hitSlop={10} activeOpacity={0.76}>
          <X s={large ? 19 : 17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>
      {!!subtitle && <Text style={[s.subtitle, large && s.subtitleLarge]}>{subtitle}</Text>}
    </>
  );
}

const s = StyleSheet.create({
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E0DA',
    marginTop: 10,
  },
  headerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRowLarge: { marginTop: 17 },
  copy: { flex: 1, minWidth: 0 },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.gold,
  },
  kickerLarge: { fontSize: 10, letterSpacing: 2.3 },
  title: {
    marginTop: 3,
    fontFamily: F.serifMedium,
    fontSize: 25,
    lineHeight: 29,
    color: C.text,
  },
  titleLarge: { marginTop: 4, fontSize: 28, lineHeight: 32, letterSpacing: -0.2 },
  subtitle: {
    marginTop: 7,
    paddingRight: 8,
    fontFamily: F.serif,
    fontSize: 13,
    lineHeight: 18,
    color: C.textSecondary,
  },
  subtitleLarge: { marginTop: 8, fontSize: 14, lineHeight: 19, paddingRight: 14 },
  closeButton: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonLarge: { width: 38, height: 38, borderRadius: 19 },
  centerHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
    marginTop: 12,
    marginBottom: 6,
  },
  centerHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  centerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSpacer: { width: 36 },
  centerTitle: {
    flexShrink: 1,
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: C.text,
    textAlign: 'center',
  },
});
