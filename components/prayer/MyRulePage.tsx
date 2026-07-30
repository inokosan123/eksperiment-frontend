import { useMemo } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Cross,
  Feather,
  Heart,
  OpenBook,
  Sparkles,
} from '@/components/icons/Icons';
import BeadLoop from '@/components/prayer/BeadLoop';
import MyRuleLeadCard from '@/components/prayer/MyRuleLeadCard';
import RibbonSectionCard from '@/components/shared/RibbonSectionCard';
import { toHsl } from '@/components/shared/tone';
import { C, F } from '@/constants/tokens';
import { MINE_ACCENT, MINE_BORDER } from '@/components/prayer/myRuleTone';
import { MY_RULE_PAGE_LABELS, PERSONAL_RULE_PREVIEW, PrayerLanguage } from '@/data/prayers/prayerCatalog';

/* ─────────────────────────────────────────────────────────────
 * MY RULE — the Prayer Book's other book.
 *
 * Every other selection in this app is a received Orthodox prayer,
 * and those are set as a page: centred, illuminated, rubricated,
 * because the words are given. This rule gives NO words, so it is
 * not a page at all — the long-standing mistake was typesetting it
 * as one, a paper preview with nothing printed on it.
 *
 * It is drawn instead in the language of the app's NEWEST work —
 * Library's and Inner's ribbon cards (`RibbonSectionCard`): colour
 * lifted in HSL rather than washed toward white, a plate running
 * near-white at the shoulder to full colour at the foot, a lit
 * hairline along the top edge, a pane of light on the shoulder, and
 * one large emblem bleeding off the right edge. Airy, ranged left,
 * a card family rather than a devotional page.
 *
 *   · THE LEAD (`MyRuleLeadCard`) — that card, and the door: pressing
 *     it starts the rule. Its emblem is the TIMER ITSELF, at rest and
 *     breathing, and its foot is a play plinth under a fold rather
 *     than the arrow orb a card that merely navigates would wear.
 *
 *   · THE JESUS PRAYER — second, not last: these two are the pair the
 *     page offers, your own rule and the one prayer that needs no
 *     book, and the ways below are the footnote to both.
 *
 *     It is a real ribbon card, gold, carrying a mark nothing else in
 *     the app carries: a prayer rope — loop, knot, tail and cross —
 *     standing whole. It was a Scripture door first, and a door
 *     borrowed whole from another screen is exactly what this page
 *     did not need.
 *
 *   · THE WAYS — the palest plate of the three, in the same
 *     construction, because it has to belong to the two above without
 *     competing with them. FIVE one-line rows, each with a small
 *     lifted seat in one of the Prayer Book's own hours' colours.
 *     ⚠ The colour is on the SEAT only; a plate around each row would
 *     be five cards inside a card. ⚠ And no rules between the rows:
 *     the list was divided by folds when its lines wrapped, and five
 *     single lines with a coloured seat each already carry their own
 *     rhythm. Reference: Linear's Health list — a tinted mark, a line
 *     of type, air, and nothing that pretends to be tappable.
 * ───────────────────────────────────────────────────────────── */

/** The ribbon palette's own lift: hue kept, saturation held, lightness raised. */
function lit(hex: string, lightness: number, satFloor = 70): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

function deep(hex: string, lightness: number, satFloor = 55): string {
  const { h, s } = toHsl(hex);
  const sat = s < 14 ? s : Math.max(s, satFloor);
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${lightness}%)`;
}

const JESUS_GOLD = '#A9863F';

/**
 * Where the prayer rope stands on the Jesus Prayer card.
 *
 * The arrow orb occupies the card's top-right corner — 36 across, inset 14 —
 * so its foot is at y=50. The rope's loop begins about a tenth of its own
 * height down from the top of its box, which puts the box's top at
 * `cardHeight - 16 - 74`; on this card's two-line description that clears 50
 * with a little room. Sixteen off each edge is what makes the tail and the
 * cross visible at all.
 */
const JESUS_MARK = { size: 74, right: 16, bottom: 16, rest: 0.34 } as const;

/** The Prayer Book's own five hours, lent to the ways one may pray. */
type WayMark = {
  Icon?: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  beads?: boolean;
  tint: string;
};

// Parallel to PERSONAL_RULE_PREVIEW[lang].listItems, which is the same five
// entries in the same order in every language. A row past the fifth falls back
// to the plain cross rather than crashing, so new copy can never break the list.
const WAY_MARKS: WayMark[] = [
  { Icon: OpenBook, tint: '#D97706' },
  { Icon: Heart, tint: '#D6456A' },
  { beads: true, tint: '#7C6EAF' },
  { Icon: Feather, tint: '#3B82F6' },
  { Icon: Sparkles, tint: '#10B981' },
];

const FALLBACK_MARK: WayMark = { Icon: Cross, tint: MINE_ACCENT };

export default function MyRulePage({
  lang,
  onStartMyRule,
  onOpenJesusPrayer,
  heroRef,
  onHeroLayout,
}: {
  lang: PrayerLanguage;
  onStartMyRule: () => void;
  onOpenJesusPrayer: () => void;
  /** Onboarding-only: the guided tour spotlights the lead card, not the page. */
  heroRef?: React.Ref<View>;
  onHeroLayout?: (event: LayoutChangeEvent) => void;
}) {
  const content = PERSONAL_RULE_PREVIEW[lang];
  const labels = MY_RULE_PAGE_LABELS[lang];
  const tint = MINE_ACCENT;

  const leadPalette = useMemo(() => ({
    border: lit(tint, 74, 62),
    gradient: [lit(tint, 97), lit(tint, 89), lit(tint, 78, 74)] as const,
    star: deep(tint, 51),
    ink: deep(tint, 36),
    title: deep(tint, 26),
    body: deep(tint, 34),
    seat: deep(tint, 30),
    dialFace: lit(tint, 96),
    dialRing: lit(tint, 76, 62),
  }), [tint]);

  return (
    <View style={s.page}>
      <MyRuleLeadCard
        eyebrow={labels.eyebrow}
        title={labels.title}
        description={content.intro}
        startAction={labels.startAction}
        startHint={labels.startHint}
        palette={leadPalette}
        onPress={onStartMyRule}
        cardRef={heroRef}
        onCardLayout={onHeroLayout}
      />

      {/* ── THE JESUS PRAYER ─────────────────────────────────────────────
          Directly under My Rule, because the two are the pair this page
          offers: your own rule, and the one prayer that needs no book. The
          list of ways follows them, as the footnote to both. */}
      <RibbonSectionCard
        label={labels.jesusEyebrow}
        title={labels.jesusTitle}
        description={labels.jesusDescription}
        titleColor="#6D4F13"
        arrowBg="#8A5A1A"
        Decor={BeadLoop}
        decorColor={JESUS_GOLD}
        decorUpright
        // A star or a cross survives being cropped by the card's corner; a
        // prayer rope does not — the default bleed cuts off the tail and the
        // cross at the end of it, which is most of what makes it a rope. So it
        // comes in off both edges and stands whole, clear of the arrow orb
        // above it, with a little more ink to make up for the smaller size.
        decorPlacement={JESUS_MARK}
        index={1}
        onPress={onOpenJesusPrayer}
        // The shared card carries its own 10pt tail for stacked lists; here the
        // page's gap already spaces it, and both would double the gutter.
        style={s.ribbonInPage}
      />

      {/* ── THE WAYS ─────────────────────────────────────────────────────── */}
      {/* The same construction as the two cards above — three-stop plate on
          the diagonal, lit edge, pane of light on the shoulder — but pitched
          far paler. It has to belong to them without competing with them: the
          lead card is the subject and the door, this is the footnote. */}
      <View style={s.waysCard}>
        <LinearGradient
          colors={['#FFFFFF', lit(tint, 98), lit(tint, 95, 40)]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={s.waysLit} />

        {/* One voice. An eyebrow reading WAYS TO PRAY stood here for a while
            over a line that already says what the list is for, and two
            headings saying the same thing is worse than either alone. */}
        <Text style={s.waysHeading}>{content.listHeading}</Text>

        <View style={s.waysList}>
          {content.listItems.map((item, index) => {
            const mark = WAY_MARKS[index] ?? FALLBACK_MARK;
            const Icon = mark.Icon;

            return (
              <View key={index} style={s.wayRow}>
                {/* A lifted seat, not a pastel wash: the same lit()/deep()
                    pair the ribbon cards are built on, so five small marks
                    belong to the same app as the plates around them.
                    ⚠ A rounded SQUARE, not a disc — a disc at this size beside
                    a line of type reads as a bullet with a picture in it. */}
                <View style={[s.waySeat, { borderColor: lit(mark.tint, 80, 60) }]}>
                  <LinearGradient
                    colors={[lit(mark.tint, 97), lit(mark.tint, 88)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  {mark.beads
                    ? <BeadLoop s={18} c={deep(mark.tint, 42)} w={1.5} />
                    : Icon ? <Icon s={16} c={deep(mark.tint, 42)} w={1.8} /> : null}
                </View>
                {/* One line, always. `adjustsFontSizeToFit` is the floor rather
                    than the plan — the copy is measured to fit at every width
                    in all three languages, and this only catches a phone at a
                    very large system text size. */}
                <Text
                  style={s.wayLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.86}
                >
                  {item}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* The footnote that points across to the Orthodox book. */}
      <View style={s.noteWrap}>
        <View style={s.noteRule} />
        <Text style={s.note}>{content.note}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // 14, not the ribbon screens' 16: this page shares a gutter with the
  // category row and preview card on the other side of the switch, and a
  // two-point step between the two books would show on every change.
  page: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 16, gap: 14 },
  ribbonInPage: { marginBottom: 0 },

  // ── Ways ──────────────────────────────────────────────────────────────
  waysCard: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: MINE_BORDER,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  waysLit: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  waysHeading: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 25,
    color: C.text,
  },
  // Air, not rules. The list was divided by folds when its lines wrapped and
  // needed separating; five one-line rows with a coloured seat each already
  // have their own rhythm, and hairlines between them only added weight to the
  // one element on this page that had to feel the lightest.
  waysList: { marginTop: 14, gap: 4 },
  wayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 7,
  },
  waySeat: {
    position: 'relative',
    overflow: 'hidden',
    width: 32,
    height: 32,
    borderRadius: 11,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wayLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: F.serif,
    fontSize: 16.5,
    lineHeight: 22,
    color: C.text,
  },

  // ── Footnote ──────────────────────────────────────────────────────────
  noteWrap: { alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 2 },
  noteRule: { width: 34, height: 1, opacity: 0.3, backgroundColor: MINE_ACCENT },
  note: {
    fontFamily: F.serifItalic,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.textMuted,
    textAlign: 'center',
  },
});
