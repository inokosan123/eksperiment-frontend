/* ─────────────────────────────────────────────────────────────
 * THE SINAI PANTOCRATOR — what the About sheet says.
 *
 * The icon stands at the centre of the My Rule prayer screen, and this
 * is the story behind it, told in seven slides.
 *
 * ⚠ EVERY CLAIM IN THIS FILE IS SOURCED, AND THE SOURCE IS NAMED IN A
 * COMMENT BESIDE IT. Two Wikipedia articles were read for it:
 *
 *   [GEN]  "Christ Pantocrator"          — the image type in general
 *   [SIN]  "Christ Pantocrator (Sinai)"  — this panel in particular
 *
 * The comments are not decoration. A later edit that improves a
 * sentence can very easily invent a fact along the way, and on a screen
 * people will pray in front of, an invented fact is the worst thing
 * this app could ship. If a claim here has no source tag, it does not
 * belong here.
 *
 * ⚠ WHAT MUST NEVER BE CLAIMED FOR THIS PANEL
 *
 * That its halo carries the letters Ο ΩΝ, or that IC XC is written on
 * it. [GEN] says only that SOME examples of the type carry a cruciform
 * halo inscribed Ο ΩΝ; [SIN] does not mention halo lettering at all.
 * The IC XC finger convention is likewise [GEN]'s statement about the
 * TYPE — [SIN] says of this panel only that the right hand opens
 * outward in blessing. Slide 4 keeps that distinction, and it must
 * keep it.
 *
 * ⚠ THE TWO SOURCES READ THE FACE DIFFERENTLY, AND BOTH READINGS ARE
 * GIVEN. [GEN]: mercy and grace on one half, the judge of unrepentant
 * sinners on the other. [SIN]: "His right side (the viewer's left) are
 * supposed to represent the qualities of his human nature, while his
 * left side (the viewer's right) represents his divinity." They fall on
 * the same axis — the viewer's left is mercy and humanity, the viewer's
 * right is judgement and divinity — so both can be told without
 * contradiction. [SIN]'s own hedge ("are supposed to represent") is why
 * slide 3 ends by saying these are readings of a painting and not
 * inscriptions on it. That sentence is not padding; it is the honest
 * part.
 *
 * ⚠ ENGLISH ONLY, FOR NOW. The screen this opens from is English
 * throughout — its title, Reset, Finish, the exit dialog, the epigraph.
 * A trilingual sheet inside an English screen is the same fault the
 * Prayer Book switch was just cured of. The shape here is a plain array
 * so that localising the screen later localises this with it.
 * ───────────────────────────────────────────────────────────── */

export type PantocratorFigure = 'icon' | 'faces';

export type PantocratorSlide = {
  id: string;
  /** Small tracked line above the title — a date, a place, a part. */
  eyebrow: string;
  title: string;
  /** One or two paragraphs. The first takes the illuminated opening. */
  body: string[];
  /** A short strip of hard values under the title, where there are any. */
  facts?: string[];
  /** The figure this slide shows, if it shows one. */
  figure?: PantocratorFigure;
};

export const PANTOCRATOR_SLIDES: PantocratorSlide[] = [
  {
    id: 'oldest',
    // [SIN] Saint Catherine's Monastery, Sinai Peninsula.
    eyebrow: "SAINT CATHERINE'S MONASTERY, SINAI",
    title: 'The oldest face of Christ',
    // [SIN] mid-6th century, concluded in 1962, exact date still unknown.
    // [SIN] encaustic — a medium using hot wax paint.
    // [SIN] 84 cm high, 45.5 cm wide, 1.2 cm thick.
    // [GEN] the oldest known surviving example of the Pantocrator.
    // [SIN] probably made in Constantinople, an imperial gift to the monastery.
    facts: ['Mid-6th century', 'Hot wax on panel', '84 × 45.5 cm'],
    body: [
      'This panel was painted in the middle of the sixth century, in hot coloured wax on a board of wood a little under a metre tall. It is the oldest surviving icon of Christ Pantocrator — Christ the Almighty — and it is kept at Saint Catherine’s Monastery, in the Sinai desert.',
      'It was probably not made there. The work is fine enough that it is thought to have come from Constantinople, sent out to the monastery as a gift from the emperor.',
    ],
    figure: 'icon',
  },
  {
    id: 'survived',
    // [GEN] iconoclasm 726–787 and 814–842; the icon survived because Sinai was
    // remote and escaped the destruction that reached most Eastern churches.
    eyebrow: '726–787 · 814–842',
    title: 'What the empire destroyed',
    body: [
      'Twice the Eastern Church turned against its own images. Through two long spells of iconoclasm, painted figures of Christ and the saints were pulled down and destroyed across the empire, and almost nothing painted before them came through.',
      'This one came through because of where it was. A monastery in the Sinai desert was remote enough that the destruction never reached it, and so a sixth-century face survived in a place too far away to matter.',
    ],
  },
  {
    id: 'faces',
    eyebrow: 'THE TWO HALVES',
    title: 'Two faces in one',
    body: [
      'The halves of this face do not match. Cover one side, then the other, and you meet two different men. Mirror each half into a whole face and the difference is impossible to miss: one is open and calm, the other grave and searching.',
      // [GEN] left half = mercy and grace; right side = the dreaded judge of
      // unrepentant sinners. [SIN] viewer's left = human nature; viewer's right
      // = divinity, worded "are supposed to represent".
      'It is read two ways. One reading takes the halves as mercy and grace on one side and the judge of unrepentant sinners on the other. The other takes them as his two natures — human on one side, divine on the other. Both are readings of a painting, not inscriptions on it.',
    ],
    figure: 'faces',
  },
  {
    id: 'hand',
    eyebrow: 'THE RIGHT HAND',
    title: 'The hand that blesses',
    body: [
      // [SIN] "His right hand is shown opening outward, signifying his gift of
      // blessing." [GEN] adds that the Pantocrator's hand is the conventional
      // rhetorical gesture representing teaching.
      'The right hand opens outward in blessing. It is also the gesture a speaker made to begin — in the older reading, the hand of someone about to teach.',
      // ⚠ [GEN] attributes the IC XC finger pose to icons of this TYPE. [SIN]
      // says only "opening outward" of this panel. Keep the two apart.
      'In icons of this type the fingers are held so they form the letters IC XC — the Greek short way of writing Jesus Christ, the first and last letter of each name. That convention belongs to the tradition the image grew into; of this panel it is recorded simply that the hand is open.',
    ],
  },
  {
    id: 'book',
    eyebrow: 'THE LEFT ARM',
    title: 'A closed book, and a word',
    body: [
      // [SIN] "the left hand and arm are clutching a thick Gospel book."
      // [GEN] a closed book with a richly decorated cover featuring the Cross.
      'The left arm holds a thick book of the Gospels, closed. It is not being read from. It is being held — the way a thing is held that does not need opening to be true.',
      // [GEN] Greek πᾶς (all) + κράτος (strength/power); "Almighty" or
      // "All-powerful"; in the Septuagint it rendered both YHWH Sabaoth and El
      // Shaddai; the New Testament uses it once in Paul and nine times in
      // Revelation.
      'Pantocrator is Greek: all, and power. It is usually put into English as Almighty. It is the word the Greek Old Testament reached for when it had to carry the Hebrew names Lord of Hosts and God Almighty, and the New Testament uses it once in Paul and nine times in Revelation.',
    ],
  },
  {
    id: 'uncovered',
    // [GEN] coarsely overpainted around the face and hands around the 13th
    // century; cleaned in 1962, revealing a very high-quality icon probably
    // produced in Constantinople. [SIN] the 1962 work is also what dated it.
    eyebrow: '13TH CENTURY · 1962',
    title: 'Painted over, then uncovered',
    body: [
      'Some time around the thirteenth century the face and the hands were coarsely painted over, and for the seven hundred years that followed, that later painting is the icon people saw.',
      // [SIN] 84 × 45.5 × 1.2 cm, "originally taller and wider before its top
      // and sides were cut"; major loss on Christ's left side including his
      // left ear and shoulder.
      'It was cleaned away in 1962, and the sixth-century picture came back underneath — far finer than the work that had hidden it. That cleaning is also how the panel was dated. It has not come through whole: the board was cut down at the top and along the sides, and Christ’s left ear and shoulder are lost.',
    ],
  },
  {
    id: 'after',
    // [GEN] Byzantine churches placed the Pantocrator in the central dome, the
    // half-dome of the apse, or the nave vault; examples include Hagia Sophia
    // and the Church of the Holy Sepulchre.
    eyebrow: 'AFTER SINAI',
    title: 'The face that went everywhere',
    body: [
      'This is the oldest surviving example of a way of picturing Christ that the Eastern Church went on to use everywhere — in the central dome of a church, in the half-dome above the altar, along the vault of the nave. It looks down from Hagia Sophia in Constantinople and from the Church of the Holy Sepulchre in Jerusalem, and from churches across the Mediterranean and Eastern Europe.',
      'The small board it survived on is still at Sinai.',
    ],
  },
];

/**
 * Shown once at the foot of the last slide.
 *
 * Not modesty — the point of the sheet is that everything in it can be
 * checked, and a reader who wants to check it should be told where to go.
 */
export const PANTOCRATOR_SOURCE_NOTE =
  'Drawn from the Wikipedia articles “Christ Pantocrator” and “Christ Pantocrator (Sinai)”.';

/** What the two mirrored composites are called, in the order they are shown. */
export const PANTOCRATOR_FACE_LABELS = {
  whole: 'THE ICON',
  // The viewer's left half, mirrored into a whole face. [GEN] mercy and grace;
  // [SIN] the qualities of his human nature.
  mercy: 'MERCY',
  // The viewer's right half, mirrored. [GEN] the judge of unrepentant sinners;
  // [SIN] his divinity.
  judgement: 'JUDGEMENT',
} as const;

/** One line under the composite, naming what you are looking at. */
export const PANTOCRATOR_FACE_CAPTIONS = {
  whole: 'The panel as it is — the halves as they were painted.',
  mercy: 'The left half of the face, mirrored into a whole one.',
  judgement: 'The right half of the face, mirrored into a whole one.',
} as const;
