import { StyleSheet, Text, View } from 'react-native';
import { F } from '@/constants/tokens';

// The three fields of a Bible note, and the one place they are described.
//
// They are not three boxes — they are a method, and it runs in order.
// You read and write down what you SAW; from what you saw you draw what it
// TEACHES; and from what it teaches you decide how you will LIVE it. Each
// step leans on the one before it, which is why they are numbered and why
// the second says to look back at the first when nothing comes.
//
// The last step is the point of the other two. Scripture is given to be
// practised, not only read, so the note does not end at understanding.
//
// Both the full-screen editor and the reader's sheet render from this, so
// the wording cannot drift between them.

export const BIBLE_NOTE_FIELDS = [
  {
    key: 'observations' as const,
    step: 1,
    label: 'OBSERVATIONS',
    description: 'What you notice as you read — the words, people and details that stand out.',
    placeholder: 'Write what you noticed…',
  },
  {
    key: 'lessons' as const,
    step: 2,
    label: 'LESSONS',
    description: 'What this chapter teaches. If nothing comes to mind, read back through your observations.',
    placeholder: 'Write what it teaches…',
  },
  {
    key: 'application' as const,
    step: 3,
    label: 'APPLICATION',
    description: 'How you will live it. Scripture is given to be practised, not only read.',
    placeholder: 'Write how you will live it…',
  },
];

export type BibleNoteFieldKey = typeof BIBLE_NOTE_FIELDS[number]['key'];

const GREEN = '#5E7B55';

/**
 * The head of a note field: its step, its name, and a line saying plainly
 * what belongs in it — then a rule, and the page begins.
 */
export function BibleNoteFieldHead({
  step,
  label,
  description,
}: {
  step: number;
  label: string;
  description: string;
}) {
  return (
    <View style={h.wrap}>
      <View style={h.titleRow}>
        <View style={h.stepSeat}>
          <Text style={h.stepText}>{step}</Text>
        </View>
        <Text style={h.label}>{label}</Text>
        <View style={h.titleRule} />
      </View>
      <Text style={h.description}>{description}</Text>
      <View style={h.headRule} />
    </View>
  );
}

const h = StyleSheet.create({
  wrap: { marginBottom: 11 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  // The step, struck in the notebook's green — the three read as one method
  // rather than as three unrelated boxes.
  stepSeat: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(94,123,85,0.34)',
    backgroundColor: 'rgba(94,123,85,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: F.serif,
    fontSize: 11.5,
    lineHeight: 14,
    color: GREEN,
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 2.05,
    color: '#4C6647',
  },
  // The rule takes whatever the name leaves, as the shelf's leader does.
  titleRule: { flex: 1, height: 1, backgroundColor: 'rgba(94,123,85,0.16)' },
  description: {
    marginTop: 7,
    marginLeft: 29,
    fontFamily: F.serifItalic,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#8E8578',
  },
  headRule: {
    marginTop: 11,
    height: 1,
    backgroundColor: 'rgba(94,123,85,0.11)',
  },
});
