import { StyleSheet, Text, View } from 'react-native';
import { Lock } from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { REGISTER_TONES } from './ProtectionRegister';

// Always Blocked, wherever it appears in a LIST of apps.
//
// The app had grown three different answers to the same thing: the plan
// builder's rose register card, the Essentials sheet's dimmed rows with an
// UNAVAILABLE pill, and a third plate in the group sheet. Three looks for one
// idea means you have to read each of them before you know what you are
// looking at. This is that idea once, so the moment it appears you recognise
// it without reading.
//
// The tone is NOT a new palette — it is `REGISTER_TONES.rose`, the same rose
// the Always Blocked card already wears everywhere else, so the list form and
// the card form are visibly the same thing at two sizes.
//
// Two rules hold this together:
//
//  1. It takes the geometry of whatever list it joins — same row height, same
//     squircle seat, same rhythm — so it reads as part of the list rather than
//     as a foreign block dropped into it.
//  2. Nothing here is pressable. Not a disabled control, which invites a tap
//     and then refuses it: there is no control at all. Where the list's
//     checkbox would sit, a LOCKED tag sits instead, so the slot that normally
//     means "choose me" visibly holds something that is not a choice.

const TONE = REGISTER_TONES.rose;

// Quieter than the card's border: this sits among ordinary rows and should
// settle beside them, not shout over them.
const GROUND = '#FFFAFB';
const EDGE = '#F1DCE0';
const SEAT = '#F9E9EC';
const INK = '#7B3945';

export function AlwaysBlockedHeading() {
  return (
    <View style={s.head}>
      <View style={s.headMark}>
        <Lock s={11} c={TONE.accent} w={2.4} />
      </View>
      <Text style={s.headLabel}>ALWAYS BLOCKED</Text>
      <View style={s.headRule} />
    </View>
  );
}

export function AlwaysBlockedRow({
  name,
  meta,
}: {
  name: string;
  /** A second line, e.g. the count when the names themselves are private. */
  meta?: string;
}) {
  return (
    <View
      style={s.row}
      accessibilityLabel={`${name}${meta ? `, ${meta}` : ''}, Always Blocked, cannot be chosen`}
    >
      <View style={s.seat}>
        <Lock s={15} c={TONE.accent} w={2.3} />
      </View>
      <View style={s.copy}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {/* Where the list's check would be. */}
      <View style={s.tag}>
        <Text style={s.tagText}>LOCKED</Text>
      </View>
    </View>
  );
}

export function AlwaysBlockedNote({ children }: { children: string }) {
  return <Text style={s.note}>{children}</Text>;
}

const s = StyleSheet.create({
  // The same construction as a category heading, so the section takes its place
  // in the list instead of interrupting it.
  head: { marginTop: 18, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  headMark: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderCurve: 'continuous',
    backgroundColor: SEAT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.9, color: TONE.accent },
  headRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: EDGE },

  row: {
    minHeight: 54,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: EDGE,
    backgroundColor: GROUND,
    paddingHorizontal: 11,
  },
  seat: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#F0D5DA',
    backgroundColor: SEAT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontFamily: F.serifMedium, fontSize: 16, color: INK },
  meta: { marginTop: 1, fontFamily: F.sans, fontSize: 12, color: '#A88E93' },
  tag: {
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#F0D5DA',
    backgroundColor: '#FDF2F4',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tagText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.1, color: TONE.accent },
  note: { marginTop: 2, marginBottom: 2, fontFamily: F.serif, fontSize: 13, lineHeight: 17.5, color: '#9C8A8D' },
});
