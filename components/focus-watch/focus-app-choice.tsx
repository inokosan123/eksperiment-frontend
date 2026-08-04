import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Lock } from '@/components/icons/Icons';
import { HapticTouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusCheck from './FocusCheck';
import { useFocusRibbonPalette } from './focusBoundaryShell';

/* ─────────────────────────────────────────────────────────────────────
 * CHOOSING AN APP — the one card, wherever the choosing happens.
 *
 * ⚠ FOCUS HAD THREE WAYS OF DRAWING THE SAME ROW. The group sheet chose
 * apps on a lit ribbon card with a cut-in icon seat; Essential Apps chose
 * them on a sectioned list with 39pt monograms; and Quiet Hour — the one
 * a reader meets first, from a gold button on the Focus screen — chose
 * them on a flat fifty-point row with a 31pt square and a tick. Three
 * answers to one question, and the plainest of them on the busiest door.
 *
 * This is the group sheet's answer, lifted out so the choosing is one
 * object rather than three drawings of it. The recipe is unchanged and
 * the palette is still `focusRibbonPalette` — HSL holding hue and
 * saturation and moving only lightness, because mixing a colour toward
 * white drains it.
 *
 * FOUR STATES, AND THEY ARE FOUR KINDS RATHER THAN FOUR SHADES:
 *
 *   chosen   a LIT card in the room's colour — the gradient, the pane of
 *            light at the shoulder, a coloured seat and a filled check.
 *   open     quiet parchment, a stone seat, an empty check. Not a dimmer
 *            version of chosen: quiet on purpose, which is what lets a
 *            chosen card read as a lit thing rather than a louder white.
 *   locked   stone, a lock, no control. Kept open for safety and not a
 *            choice anybody gets to make.
 *   blocked  rose, a lock, no control. Shut by a rule made elsewhere.
 *
 * ⚠ COLOUR IS NEVER THE ONLY SIGNAL. Every state carries a mark as well:
 * a check, an empty check, or a lock, and the locked kinds say so in
 * words on the card.
 * ───────────────────────────────────────────────────────────────────── */

export type AppChoiceState = 'chosen' | 'open' | 'locked' | 'blocked';

/** Rose, the app's colour for a thing held shut. */
export const CHOICE_ROSE = '#A24351';
const CHOICE_ROSE_INK = '#8F3443';

/**
 * The seat the app's initial sits in.
 *
 * ⚠ CUT IN RATHER THAN RAISED — an icon will sit IN this one day, so it
 * is a recess: a shadow inside the top edge and light along the bottom
 * lip. On a coloured card the seat goes near-white, because a tinted
 * inset on a tinted ground simply disappears.
 */
const AppSeat = memo(function AppSeat({
  label,
  ground,
  edge,
  ink,
}: {
  label: string;
  ground: string;
  edge: string;
  ink: string;
}) {
  return (
    <View style={[s.seat, { backgroundColor: ground, borderColor: edge }]}>
      <View pointerEvents="none" style={s.seatWell} />
      <Text style={[s.seatText, { color: ink }]} allowFontScaling={false}>
        {label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
});

/**
 * One app, and what is going to happen to it.
 *
 * `note` is the reason, said in words beside the mark — a lock with no
 * sentence is a state the reader has to guess at.
 */
export const AppChoiceCard = memo(function AppChoiceCard({
  id,
  name,
  state,
  accent,
  note,
  onToggle,
  entering,
}: {
  id: string;
  name: string;
  state: AppChoiceState;
  /** The room's colour. Spent on the card only when the app is chosen. */
  accent: string;
  note?: string;
  /** Omitted for the two locked kinds — they are not controls. */
  onToggle?: (id: string) => void;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
}) {
  const chosen = state === 'chosen';
  const blocked = state === 'blocked';
  const palette = useFocusRibbonPalette(blocked ? CHOICE_ROSE : accent);
  const pressable = state === 'chosen' || state === 'open';

  const label = note ? `${name}, ${note}` : name;
  const hint = pressable
    ? chosen
      ? 'Double tap to close this app during Quiet Hour.'
      : 'Double tap to keep this app open during Quiet Hour.'
    : undefined;

  /* ⚠ A PLAIN ANIMATED VIEW, NOT `FocusAppCardShell`. That shell composes
     an avatar, title, subtitle, rail and chip for callers who hand it
     parts; this card hands it a finished row instead, which takes the
     shell's `children` branch and leaves everything else — including the
     accessibility props it would otherwise apply — unused. The real
     labelling belongs on the control below, where the tap is. */
  return (
    <Animated.View
      layout={LinearTransition.duration(200)}
      entering={entering}
      style={[
        s.card,
        chosen
          ? { borderColor: palette.border }
          : blocked
            ? { borderColor: palette.border, backgroundColor: palette.gradient[0] }
            : s.cardQuiet,
      ]}
    >
      {chosen && (
        <>
          <LinearGradient
            colors={palette.gradient}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* ⚠ Corner to corner, transparent well before any edge: a
              fading layer that stops mid-card rules a hard line across it
              as cleanly as if one had been drawn. */}
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            locations={[0, 0.55]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View pointerEvents="none" style={s.cardLit} />
        </>
      )}

      <ChoiceRow
        id={id}
        name={name}
        note={note}
        state={state}
        palette={palette}
        onToggle={pressable ? onToggle : undefined}
        label={label}
        hint={hint}
      />
    </Animated.View>
  );
});

function ChoiceRow({
  id, name, note, state, palette, onToggle, label, hint,
}: {
  id: string;
  name: string;
  note?: string;
  state: AppChoiceState;
  palette: ReturnType<typeof useFocusRibbonPalette>;
  onToggle?: (id: string) => void;
  label: string;
  hint?: string;
}) {
  const chosen = state === 'chosen';
  const blocked = state === 'blocked';
  const shut = blocked || state === 'locked';

  const body = (
    <>
      <AppSeat
        label={name}
        ground={chosen || blocked ? palette.inset : STONE_SEAT}
        edge={chosen || blocked ? palette.insetEdge : STONE_EDGE}
        ink={chosen || blocked ? palette.seatInk : STONE_INK}
      />
      <View style={s.copy}>
        <Text
          style={[
            s.name,
            chosen && { color: palette.name },
            blocked && { color: CHOICE_ROSE_INK },
            state === 'locked' && s.nameQuiet,
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {!!note && (
          <Text
            style={[s.note, blocked && { color: CHOICE_ROSE_INK }]}
            numberOfLines={1}
          >
            {note}
          </Text>
        )}
      </View>
      {shut ? (
        <Lock s={14} c={blocked ? CHOICE_ROSE : C.textMuted} w={2.2} />
      ) : (
        <FocusCheck checked={chosen} size={25} accent={C.gold} />
      )}
    </>
  );

  if (!onToggle) {
    return (
      <View style={s.row} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }

  return (
    <HapticTouchableOpacity
      style={s.row}
      onPress={() => onToggle(id)}
      activeOpacity={0.74}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: chosen }}
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      {body}
    </HapticTouchableOpacity>
  );
}

/** Stone: an app with no colour of its own to show yet. */
const STONE_SEAT = '#F3F1EC';
const STONE_EDGE = '#E6E2D9';
const STONE_INK = '#9A9186';

const s = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    marginTop: 8,
    shadowColor: '#5A4A22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 1,
  },
  cardQuiet: {
    backgroundColor: '#FCFBF7',
    borderColor: '#EAE6DC',
    shadowOpacity: 0.04,
  },
  /** The lit hairline every raised surface in this app wears. */
  cardLit: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  copy: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.15,
    color: C.text,
  },
  nameQuiet: { color: '#57534E' },
  note: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    lineHeight: 14,
    color: C.textMuted,
  },

  seat: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  seatWell: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  seatText: { fontFamily: F.serifSemiBold, fontSize: 16, lineHeight: 20 },
});
