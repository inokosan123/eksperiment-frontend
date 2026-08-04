import { forwardRef, memo, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { ChevronRight } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { BANKED, BankedGlint, LedgerRail, RestSeal } from '@/components/shared/BankedEmber';
import { FocusMedalCoin } from './FocusMedallion';
import MedalDayInProgress from './MedalDayInProgress';
import DayGauge from './DayGauge';
import { RadiantTrophy, StreakMedallion, TrophyShineBackdrop } from './TrophyRadiance';
import { fuseMedalStreakWeek, type MedalStreakWeekCell } from './medalStreakWeek';
import { useFocusMainMotion } from './focus-main-motion';
import type { LiveDayStatus } from './dayPlanStore';

export type { MedalStreakWeekCell };

/**
 * MEDAL STREAK — the Focus tab's streak card.
 *
 * The app has three streak rooms and they are deliberately not one template:
 * Home is a golden dawn with a fire in it, the Journal is a dark hearth, and
 * this one is a MINT. Everything on it is struck: the medal, the rings the
 * blow threw across the ground behind it, the coins in the week strip, the
 * light passing over the plate. And it is the only one of the three that
 * carries two metals — the medallion's violet under the gold — which is what
 * lets it stand a step above the others without leaving the family.
 *
 * Two registers. LIVE, a medal is on the table today. BANKED, none is — no
 * plan, or a plan with no daily limit — and the card holds: warm parchment,
 * ash weave, a rest seal, and one slow coal. Everything below that changes is
 * the live register; the banked one is settled and stays as it is.
 */

/* The card's own geometry. The rings of the strike are drawn on the backdrop
   and the medal that threw them stands in the content above it, so the two
   have to agree to the pixel — a ring a few points off centre reads as a
   mistake in the drawing rather than as a ripple. Horizontally that is exact
   arithmetic: the crest is the hero row's last child, so its centre is one
   half-width in from the row's right padding. Vertically everything is known
   EXCEPT the header line's own height, which belongs to the type engine — so
   that one number is measured rather than guessed. */
const CARD_PAD_H = 16;
const CARD_PAD_TOP = 15;
const HEADER_MIN_H = 18;
// The crest is mounted on a pale roundel that reaches past its own box, so the
// hero row needs room above it — at 14 the mount ran into the header line.
const HERO_MARGIN_TOP = 22;
const HERO_PAD_RIGHT = 22;
const CREST_SIZE = 76;

const STRIKE_RIGHT = CARD_PAD_H + HERO_PAD_RIGHT + CREST_SIZE / 2;

/** Every mark in the week strip is one coin wide — won, lost, resting or due. */
const MARK = 27;

/* The live field.

   It needed value, and for one pass it got value everywhere: a honey gold deep
   enough to hold a white plaque, run across the whole plate. That is one
   correction too many. The mounted objects carry their own contrast — a gold
   rim and a violet shadow apiece — so the plate does not have to darken to
   make them legible, and a card that darkens all over loses the light that
   made it worth looking at.

   So the plate is the app's LIGHT gold nearly everywhere, and the deep gold is
   spent in exactly one place: pooled into the bottom-left corner, under the
   white instrument that ends the card, where it is the difference between a
   bar you read and a bar you look for. One dark corner on a light plate is
   composition; darkness everywhere is just a heavier card. */
const FIELD = ['#FAEAC1', '#FEF6E1', '#FFFDF6'] as const;

/* Deeper than the app's shared gold ink by one step, to hold its contrast
   against a field that is now a shade richer under it. */
const INK = '#7A5C25';

/**
 * The rule that divides one register of the streak card from the next.
 *
 * A gold hairline that fades out at both ends, with white caught just under
 * it — the fold a lit surface makes, and the app's own answer to "where does
 * this section end". The card had two hard-edged borders running its full
 * width instead: a ruled box drawn on a surface that has no other straight
 * edge anywhere on it.
 */
function CardRule({ banked = false, style }: { banked?: boolean; style?: ViewStyle }) {
  const gold = banked ? 'rgba(168,152,119,0.34)' : 'rgba(176,133,52,0.38)';
  return (
    <View pointerEvents="none" style={[s.cardRule, style]}>
      <LinearGradient
        colors={['rgba(197,160,89,0)', gold, 'rgba(197,160,89,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.cardRuleLine}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.cardRuleLine}
      />
    </View>
  );
}

export type MedalStreakCardProps = {
  streak: number;
  week: MedalStreakWeekCell[];
  /** No medal is on the table today — the card holds instead of reading. */
  banked: boolean;
  /** No plan at all today: the week strip is meaningless, so it is dropped. */
  restDay: boolean;
  liveStatus: LiveDayStatus;
  hasPlan: boolean;
  targetMinutes: number | null;
  toleranceEndMinutes: number | null;
  usedMinutes: number | null;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const MedalStreakCard = forwardRef<ComponentRef<typeof TouchableOpacity>, MedalStreakCardProps>(
  function MedalStreakCard({
    streak,
    week,
    banked,
    restDay,
    liveStatus,
    hasPlan,
    targetMinutes,
    toleranceEndMinutes,
    usedMinutes,
    onPress,
    onLayout,
  }, ref) {
    const motionEnabled = useFocusMainMotion();
    const [headerHeight, setHeaderHeight] = useState(0);
    const strike = headerHeight > 0
      ? {
          right: STRIKE_RIGHT,
          top: CARD_PAD_TOP + headerHeight + HERO_MARGIN_TOP + CREST_SIZE / 2,
          crest: CREST_SIZE,
        }
      : undefined;

    return (
      <TouchableOpacity
        ref={ref}
        onLayout={onLayout}
        style={[s.surface, banked && s.surfaceBanked]}
        activeOpacity={0.86}
        onPress={onPress}
      >
        <LinearGradient
          colors={banked ? BANKED.surface : FIELD}
          start={banked ? { x: 0, y: 0 } : { x: 0, y: 0.06 }}
          end={banked ? { x: 1, y: 1 } : { x: 1, y: 0.78 }}
          style={StyleSheet.absoluteFill}
        />
        {/* The ground: violet haze on the left, the medal's own warm pool on
            the right, deeper gold under the instrument at the foot, and the
            app's rake over all of it — or, banked, the ash weave and a few
            slow embers. The card used to lay a second hero wash of its own
            here, guessed into place beside the medal; the backdrop is given
            the medal's measured centre now and lights it directly. */}
        <TrophyShineBackdrop muted={banked} strike={strike} />
        {/* The white hairline every raised surface in this app catches along
            its top, gone at both ends the way every other rule on this card
            fades rather than stopping. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.topLight}
        />
        {/* A pane of light passes over the plate — Home's white light, at
            Home's cadence, because one app has one sun. It is the largest
            motion this card owns and the reason a gold plate reads as struck
            metal rather than as printed paper. Resting, it is the warm ash
            pass the other resting cards wear. */}
        <BankedGlint variant={banked ? 'ash' : 'active'} active={motionEnabled} />

        <View
          style={s.headerRow}
          onLayout={event => {
            const { height } = event.nativeEvent.layout;
            setHeaderHeight(current => Math.abs(current - height) < 0.5 ? current : height);
          }}
        >
          <View style={s.kickerGroup}>
            {/* The struck diamond that caps every engraved rail in the app,
                here as the kicker's own registration mark. */}
            <View style={[s.kickerGem, banked && s.kickerGemBanked]} />
            <Text style={[s.kicker, banked && s.kickerBanked]}>MEDAL STREAK</Text>
          </View>
          <View style={s.calendarLink}>
            <Text style={[s.calendarLinkText, banked && s.calendarLinkTextBanked]}>Monthly calendar</Text>
            <ChevronRight s={13} c={banked ? BANKED.inkMuted : INK} w={2.2} />
          </View>
        </View>

        <View style={s.heroRow}>
          <View style={s.medallion}>
            <StreakMedallion value={streak} banked={banked} />
          </View>
          {/* Mounted. No hairline halo either — the rosette wears a scalloped
              rim of its own, and a circle drawn round it is a second rim in a
              second shape, crossing the ribbons on its way past. */}
          <RadiantTrophy size={CREST_SIZE} banked={banked} stage />
        </View>

        {banked && (
          <RestSeal
            label={restDay ? 'REST DAY' : streak > 0 ? 'STREAK HELD' : 'NO TARGET'}
            style={s.seal}
          />
        )}

        <Text style={[s.headline, banked && s.headlineBanked]} numberOfLines={2}>
          {liveStatus === 'broken'
            ? 'Today’s medal is resting.'
            : targetMinutes != null
              ? streak === 0
                ? 'Hold today’s limit and the first medal is yours.'
                : 'Today’s medal is within reach.'
              : restDay
                ? streak > 0
                  ? 'A rest day — your streak is still active.'
                  : 'A rest day. Your first medal waits for a plan.'
                : streak > 0
                  ? 'No target today — the streak keeps its place.'
                  : 'No target today. Set a daily limit to strike the first medal.'}
        </Text>

        {/* A rest day has nothing to place across the week, so the strip
            is dropped entirely — the crest and seal carry it alone. */}
        {!restDay && (
          <>
            <CardRule banked={banked} style={s.weekRuleTop} />
            <View style={s.weekBand}>
              {fuseMedalStreakWeek(week).map(cell => {
                // Today can only be won when a trophy is on the table; on a
                // banked day its cell rests with the others, keeping a warm
                // coal so it is still findable.
                const todayBanked = banked && cell.status === 'today';
                return (
                  <View key={cell.key} style={s.weekCell}>
                    <Text style={[
                      s.weekLetter,
                      cell.status === 'today' && (todayBanked ? s.weekLetterTodayBanked : s.weekLetterToday),
                    ]}>{cell.letter}</Text>
                    <View style={s.weekMarkWrap}>
                      {/* The band that fuses a run of won days into one
                          chain, drawn per cell as two half segments so
                          neighbours meet seamlessly at the cell border.
                          Banked, the chain cools with everything else. */}
                      {cell.linkLeft && (
                        <View
                          pointerEvents="none"
                          style={[s.chain, s.chainLeft, cell.softLeft && s.chainSoft, banked && s.chainBanked]}
                        />
                      )}
                      {cell.linkRight && (
                        <View
                          pointerEvents="none"
                          style={[s.chain, s.chainRight, cell.softRight && s.chainSoft, banked && s.chainBanked]}
                        />
                      )}
                      {/* Every mark on this strip is the coin's size. They
                          used to sit in 34pt seats whose own borders and fills
                          WERE the mark, so a day at rest and a day lost both
                          came out visibly larger than a day that was won —
                          the row read as its failures. The seat is empty air
                          now and the mark is the object. */}
                      <View style={s.weekDot}>
                        {/* Today is the one shared object on this strip: the
                            same day-in-progress the monthly calendar mounts,
                            so the two rooms cannot drift apart again. */}
                        {cell.status === 'today' && (
                          <MedalDayInProgress
                            size={MARK}
                            banked={todayBanked}
                            active={motionEnabled}
                          />
                        )}
                        {cell.status === 'kept' && <FocusMedalCoin size={MARK} />}
                        {/* ⚠ A LOST DAY IS A COIN TOO, STRUCK. It used to be
                            the only object on this row that was not one — a
                            pink circle with a small red cross, which read as
                            an error badge stuck to a ledger rather than as a
                            day the ledger had recorded. Struck, it is the
                            same coin in the register Home already uses for a
                            day the reader lost. */}
                        {cell.status === 'broken' && <FocusMedalCoin size={MARK} tone="struck" />}
                        {cell.status === 'rest' && <View style={s.markRest} />}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
            <CardRule banked={banked} style={s.weekRuleBottom} />
          </>
        )}

        {targetMinutes != null ? (
          <View style={s.gauge}>
            {/* The instrument's name. Its marker layer carries the goal mark
                two thirds of the way across, so without a label the whole left
                of that band was empty card and the bar read as something
                orphaned at the card's foot rather than as the day's reading. */}
            <Text style={s.gaugeCaption}>TODAY’S LIMIT</Text>
            <DayGauge
              goalMinutes={targetMinutes}
              toleranceEndMinutes={toleranceEndMinutes}
              usedMinutes={usedMinutes}
              accent="#8A5A1A"
              // The gauge's own label ink, set to the card's kicker gold: at
              // the shared #A9863F the GOAL caption was a full step lighter
              // than TODAY'S LIMIT beside it, and the instrument read as two
              // labels from two different cards.
              labelColor="#8A6A2C"
              height={10}
            />
          </View>
        ) : (
          // The instrument's slot is kept, closed like a ledger line: a
          // resting plan has no daily limit, a rest day has no plan at all.
          <LedgerRail
            label={hasPlan ? 'NO DAILY LIMIT TODAY' : 'NO ACTIVE PLAN TODAY'}
            style={restDay ? s.railRestDay : s.gauge}
          />
        )}
      </TouchableOpacity>
    );
  },
);

export default memo(MedalStreakCard);

const s = StyleSheet.create({
  // The card is a quiet warm plate with a gold rim — the app's own card, not
  // a stage. What makes it the streak card is what stands on it.
  surface: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    backgroundColor: '#FFFDF7',
    paddingHorizontal: CARD_PAD_H,
    paddingTop: CARD_PAD_TOP,
    // The gauge is the card's last child, and the card clips to its own
    // rounded corners — without a bottom padding the bar was cut through by
    // the edge. It gets more than the side inset rather than the same: a thin
    // instrument crowded by a rim reads as trimmed even when it is whole, so
    // the card ends on a clear band of parchment under the reading.
    paddingBottom: 22,
    shadowColor: '#6B5836',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 3,
  },
  surfaceBanked: { backgroundColor: '#FCFAF4', borderColor: BANKED.border, shadowOpacity: 0.07 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: HEADER_MIN_H,
  },
  kickerGroup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kickerGem: {
    width: 4,
    height: 4,
    borderRadius: 0.5,
    backgroundColor: 'rgba(122,92,37,0.62)',
    transform: [{ rotate: '45deg' }],
  },
  kickerGemBanked: { backgroundColor: BANKED.ashLine },
  kicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: INK },
  kickerBanked: { color: BANKED.inkMuted },
  heroRow: {
    marginTop: HERO_MARGIN_TOP,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: HERO_PAD_RIGHT,
  },
  medallion: { alignItems: 'center' },
  // The footer instrument sits in the band between the strip's lower rule and
  // the card's edge, with room on both sides of it: the bar itself is thinner
  // now (10, not 12), and the space it stands in is wider, so it reads as an
  // instrument laid on the card rather than as a strip pressed into its rim.
  // The marker layer above the bar is mostly air, so a touch more room under
  // it lands optically even.
  gauge: { marginTop: 15, paddingHorizontal: 2 },
  // Sits on the same line as the gauge's own floating marks, at the left end
  // the marks never reach.
  gaugeCaption: {
    marginBottom: -13,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.9,
    color: 'rgba(122,92,37,0.72)',
  },
  // A rest day drops the week strip and its rules, so the rail follows the
  // headline directly and takes that missing 2 back into its own margin.
  railRestDay: { marginTop: 28, paddingHorizontal: 2 },
  calendarLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  calendarLinkText: { fontFamily: F.serifSemiBold, fontSize: 13.5, color: INK },
  calendarLinkTextBanked: { color: BANKED.inkMuted },
  topLight: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 0,
    height: 1,
  },
  // Equal columns rather than seven marks pushed apart: the chain's half
  // segments only meet at a cell border if the cells actually have borders,
  // and the strip stops touching the card's padding edges into the bargain.
  // The letter sits close to its own mark — it labels the mark, and 6pt of
  // air between them made each column read as two separate things.
  weekCell: { flex: 1, alignItems: 'center', gap: 3 },
  // The mark's own seat, so the chain's vertical position is measured from
  // the mark and not from whatever line box the weekday letter happens to
  // take on a given platform.
  weekMarkWrap: { width: '100%', height: 34, alignItems: 'center', justifyContent: 'center' },
  // The golden chain fusing consecutive won days — the monthly calendar's
  // band, brought down onto the card the streak is actually claimed on.
  // A RIBBON, not a rule. Given hairline borders top and bottom it drew two
  // straight lines out past the coins in both directions and read as ruling on
  // the page. Kept narrower than the coin it links, with no edges of its own,
  // it disappears behind each coin and shows only in the gaps — which is what
  // a ribbon threaded through a row of medals does.
  chain: {
    position: 'absolute',
    top: 9,
    height: 9,
    backgroundColor: 'rgba(222,180,98,0.55)',
  },
  // Each half runs to its own cell border so neighbours meet seamlessly there.
  // Insetting them to hide the ribbon behind the coins was tried and it simply
  // cut the run into disconnected stubs: the gap between two coins is WIDER
  // than either inset, so what the ribbon has to do is cross it.
  chainLeft: { left: 0, right: '50%' },
  chainRight: { left: '50%', right: 0 },
  // The bridge tone: a run carried across a rest day, or reaching into today.
  chainSoft: { backgroundColor: 'rgba(226,188,110,0.24)' },
  chainBanked: { backgroundColor: 'rgba(198,181,148,0.3)' },
  weekLetter: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 0.6, color: '#B5A988' },
  weekLetterToday: { color: INK },
  weekLetterTodayBanked: { color: BANKED.inkMuted },
  weekDot: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A day lost is a rose token the size of the coin it did not become.
  // The rose token has to hold its own against a plate that is now gold on
  // every side of it — at the old hairline it dissolved into the card.
  // A day with no target was ruled in a cold grey that belongs to no other
  // surface on this card. It is the card's own gold now, held faint: an empty
  // seat waiting, not a disabled control.
  markRest: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 1.4,
    borderColor: 'rgba(186,146,72,0.62)',
    borderStyle: 'dashed',
  },
  // Today's seat, its rim, its warmth and its spark all live in
  // MedalDayInProgress now — the one object this strip and the monthly
  // calendar both mount.
  seal: { marginTop: 12 },
  // 19, not 13: the mount hangs 12pt below the hero row it stands in, and at
  // the old margin the sentence started exactly where the roundel ended.
  headline: { marginTop: 19, fontFamily: F.serifItalic, fontSize: 15, lineHeight: 20, color: '#8A7A5C', textAlign: 'center' },
  headlineBanked: { marginTop: 11, color: BANKED.ink },
  // The strip lives between two hairlines, and the band inside them was mostly
  // air: 14 above and 16 below a row whose tallest element is 34pt made the
  // rules read as a box drawn far from what it encloses. The marks sit in
  // their frame now. Enough room is kept under them for today's halo, which
  // breathes 7.5pt past its own seat and must never touch the lower rule.
  weekBand: {
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
  },
  // And the frame itself moves up under the sentence: the headline is centred
  // prose and the strip is the card's evidence for it, so the two belong
  // together rather than a full line of card apart.
  weekRuleTop: { marginTop: 10 },
  weekRuleBottom: { marginBottom: 2 },
  cardRule: { height: 2 },
  cardRuleLine: { height: 1 },
});
