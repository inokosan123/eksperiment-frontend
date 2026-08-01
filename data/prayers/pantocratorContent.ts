/* ─────────────────────────────────────────────────────────────
 * THE SINAI PANTOCRATOR — what the About sheet says.
 *
 * The icon stands at the centre of the My Rule prayer screen, and this
 * is the story behind it, told in five slides.
 *
 * ⚠ THE SHEET NOW CARRIES TWO KINDS OF STATEMENT, AND THE DIFFERENCE
 * BETWEEN THEM IS THE MOST IMPORTANT THING IN THIS FILE.
 *
 *   FACT        when it was painted, what it was painted with, where it
 *               is kept, what it is holding, what survived. These are
 *               checkable, and the two Wikipedia articles below are
 *               where they were checked:
 *
 *                 [GEN]  "Christ Pantocrator"         — the image type
 *                 [SIN]  "Christ Pantocrator (Sinai)" — this panel
 *
 *   READING     what the raised hand means, what the two halves mean,
 *               what the Gospel book signifies. These are how the
 *               Christian tradition has read this image for centuries.
 *               They are not measurements and the sheet must never let
 *               them sound like measurements.
 *
 * ⚠ SO THE SLIDES ARE ORDERED FACT FIRST, READING AFTER. One and two
 * establish what the object is. Three, four and five say how it has been
 * understood. A reader who accepts the first two and doubts the last
 * three has read the sheet correctly.
 *
 * ⚠ AND THE ONE SENTENCE THAT MUST NEVER BE CUT is the last paragraph of
 * slide three: the mirrored portraits are MODERN COMPOSITES, built here
 * out of the one photograph, and they are not two images that exist in
 * the icon. Without it, a reader can leave believing the monastery holds
 * two faces of Christ. It is the honest part, and it is not padding.
 *
 * ⚠ WHAT MUST NEVER BE CLAIMED FOR THIS PANEL: that its halo carries the
 * letters Ο ΩΝ, or that IC XC is written on it. [GEN] says only that
 * SOME examples of the type carry a cruciform halo inscribed Ο ΩΝ, and
 * the IC XC finger convention is likewise [GEN]'s statement about the
 * TYPE. [SIN] says of this panel only that the right hand opens outward.
 *
 * ⚠ ENGLISH ONLY, FOR NOW. The screen this opens from is English
 * throughout — its title, Reset, Finish, the exit dialog, the epigraph.
 * A trilingual sheet inside an English screen is the same fault the
 * Prayer Book switch was cured of. The shape here is a plain array so
 * that localising the screen later localises this with it.
 * ───────────────────────────────────────────────────────────── */

/* ── WHAT STANDS IN THE CHAPEL ────────────────────────────────────────
 *
 * ⚠ EVERY PAGE NOW SHOWS THE THING IT IS TALKING ABOUT, and all of it is
 * cut from the ONE photograph — see PANTOCRATOR_DETAILS. Three of the
 * five pages used to be prose alone on a beige page: a page about the
 * blessing hand with no hand on it, a page about the Gospel book with no
 * book. The reader was being told about an object they could not see
 * while an image of it sat two swipes away.
 *
 *   panel   the whole board. It opens the sheet and it closes it —
 *           the essay pulls back to the whole once it has walked
 *           through the parts, which is also why the last page's way
 *           out is called Return to the icon.
 *   gaze    the eyes, close. The page about His nearness.
 *   faces   the two mirrored composites, side by side.
 *   hands   the open hand and the Gospel book, together — the two sides
 *           the page is about, in one figure.
 */
export type PantocratorFigure = 'panel' | 'gaze' | 'faces' | 'hands';

/** One line of the museum plate: what it is, and what it says. */
export type PantocratorPlateRow = { label: string; value: string };

export type PantocratorSlide = {
  id: string;
  /** Small tracked line above the title — a date, a place, a part. */
  eyebrow: string;
  title: string;
  /**
   * THE PART'S OWN COLOUR.
   *
   * ⚠ THE SHEET WAS GOLD AND ONLY GOLD, and that is why it did not look
   * like this app. The Prayer Book gives every hour a colour — amber for
   * morning, blue for meals, violet for evening, gold for the Jesus
   * prayer, emerald for the rest — and spends it the way a printed book
   * spends red: on the versal, the rubric, the ornament and the plaque's
   * lettering, never on the ground. Five parts, five colours, the app's
   * own five. It makes the About sheet a member of the Prayer Book
   * rather than a visitor to it.
   *
   * `lit` is the same colour raised to read on the chapel's dark wall,
   * kept as a value rather than computed because the head-band
   * cross-fades between two of them on the UI thread, and a colour that
   * has to be parsed out of an `hsl()` string cannot be interpolated
   * there.
   */
  accent: string;
  lit: string;
  /** One or more paragraphs. The first takes the illuminated opening. */
  body: string[];
  /**
   * The tombstone label — what a museum hangs beside a panel.
   *
   * ⚠ IT REPLACED A RUN-ON STRIP OF TRACKED CAPITALS. "MID-6TH CENTURY ◆
   * HOT WAX ON PANEL ◆ 84 × 45.5 CM" was three unlike facts run together
   * at nine and a half points with no way to tell which was which. Named
   * rows read at a glance and are the form the reader has already met on
   * every museum wall.
   */
  plate?: PantocratorPlateRow[];
  /** The figure this slide shows, if it shows one. */
  figure?: PantocratorFigure;
  /** One line under the figure, naming what is being looked at. */
  caption?: string;
  /** The closing line of the whole sheet, set apart. */
  envoi?: string;
};

/* ⚠ THE PHRASE THAT CARRIES EACH PARAGRAPH IS MARKED `**LIKE THIS**`.
 *
 * Five pages of unbroken sixteen-point serif is a wall, and a reader who
 * cannot find a foothold in a wall skims it or leaves. Every paragraph
 * below names the one phrase it is actually about, and the sheet sets
 * that phrase in the semibold — so the page can be READ line by line or
 * SCANNED by its bolds, and both give the same answer.
 *
 * ⚠ AUTHORED, NOT MECHANICAL. Bolding the first four words of every
 * paragraph is a pattern the eye learns to ignore in two paragraphs; the
 * marks here fall where the meaning is, which is why they are in the
 * content and not in a function.
 */

export const PANTOCRATOR_SLIDES: PantocratorSlide[] = [
  {
    id: 'oldest',
    // [SIN] Saint Catherine's Monastery, Sinai Peninsula.
    eyebrow: "SAINT CATHERINE'S MONASTERY, SINAI",
    title: 'The oldest surviving icon of Christ',
    // Gold — the Jesus prayer's own colour, and the halo's.
    accent: '#C5A059',
    lit: '#E9D2A2',
    // [SIN] mid-6th century, concluded in 1962, exact date still unknown.
    // [SIN] encaustic — a medium using hot wax paint.
    // [SIN] 84 cm high, 45.5 cm wide, 1.2 cm thick.
    plate: [
      { label: 'Painted', value: 'Mid-6th century' },
      { label: 'Medium', value: 'Hot wax on wood' },
      { label: 'Panel', value: '84 × 45.5 cm' },
    ],
    body: [
      // [SIN] mid-6th century; encaustic. [GEN] the oldest known surviving
      // example of the Pantocrator type.
      '**Painted in the mid-sixth century**, this is the oldest surviving icon of Jesus Christ. Created on a wooden panel with pigments bound in heated wax, it has endured for nearly fifteen centuries while preserving an extraordinary richness of colour, light, and expression.',
      // [SIN] kept at Saint Catherine's Monastery; [GEN] the icon survived the
      // iconoclasms because Sinai was remote.
      'The icon is kept at **Saint Catherine’s Monastery on Mount Sinai** in Egypt. The monastery’s remote location, dry climate, and continuous monastic life helped preserve many early Christian treasures that disappeared elsewhere during centuries of conflict and destruction.',
      // [GEN] the type went on to be used across the Eastern Church — dome,
      // apse half-dome, nave vault.
      // ⚠ TWO MARKS, AND THEY ARE THE TWO HALVES OF ONE SENTENCE — "not
      // only X, but Y". Marking one half and leaving the other sets up an
      // antithesis and then drops it; the eye scanning the bolds would
      // read "not only because of its age" and never meet the because.
      'This icon is especially important **not only because of its age**, but because it became one of the **most influential representations of Christ in Christian art**. Its direct gaze, raised hand, Gospel book, and solemn presence shaped the image of Christ Pantocrator for generations that followed.',
    ],
    // The board itself, standing the full height of the chapel. It takes
    // no caption: the plate under the title says everything a caption
    // would, and the board wants every point of wall it can get.
    figure: 'panel',
  },
  {
    id: 'pantocrator',
    eyebrow: 'THE NAME',
    title: 'Christ Pantocrator',
    // Violet — the evening hour's, and the colour a ruler is vested in.
    accent: '#7C6EAF',
    lit: '#C6BEE4',
    figure: 'gaze',
    caption: 'The eyes, close — the whole panel is built to be met at this distance.',
    body: [
      // [GEN] Greek πᾶς (all) + κράτος (strength/power); usually rendered
      // "Almighty" or "All-powerful".
      'The Greek title Pantocrator means **“Almighty,” “All-Powerful,” or “Ruler of All.”** It presents Jesus Christ as Lord of heaven and earth — the One through whom all things exist and under whose authority all creation is held.',
      'Christ appears **almost frontally** and fills nearly the entire panel. His closeness to the viewer gives the image an immediate and personal presence. He is not shown as a distant figure from the past, but as the living Lord who sees, teaches, blesses, and reigns.',
      // [SIN] the right hand opens outward in blessing; the left arm clutches a
      // thick Gospel book. [GEN] the open hand is also the rhetorical gesture
      // of teaching.
      '**His right hand is raised** in a gesture of teaching and blessing. In His left hand He holds a richly decorated Gospel book. Together, these details present Christ as both the merciful Teacher who calls humanity toward life and the sovereign Lord whose word reveals truth.',
      'The image unites qualities that may first seem opposite: **majesty and nearness, strength and compassion**, divine authority and personal mercy.',
    ],
  },
  {
    id: 'faces',
    eyebrow: 'THE TWO HALVES',
    title: 'One face. Two natures.',
    accent: '#3B82F6',
    lit: '#A9C7FB',
    figure: 'faces',
    caption: 'Each half of the face, mirrored into a whole one.',
    body: [
      'The two sides of Christ’s face are **noticeably different**. The eyes, brows, cheeks, and mouth do not form a perfectly symmetrical portrait. One side appears gentler and more open, while the other appears darker, more solemn, and commanding.',
      // [SIN] "His right side (the viewer's left) are supposed to represent the
      // qualities of his human nature, while his left side (the viewer's right)
      // represents his divinity." ⚠ The source's own hedge is why this is
      // written as an interpretation and not as a fact about the panel.
      'This remarkable contrast has often been interpreted in light of the Christian belief that Jesus Christ is **both fully divine and fully human**. His divine and human natures are not divided into two persons, nor blended into something incomplete. They are united without confusion or separation in the one Person of Jesus Christ.',
      'The difference between the two sides should therefore **not be understood as two separate faces** or two different Christs. It can instead lead the viewer toward the mystery of one Christ who is truly God and truly man.',
      // ⚠ THIS PARAGRAPH IS NOT OPTIONAL. The composites above it are built by
      // this app out of the single photograph — a crop and a mirror. Without
      // this sentence a reader can leave believing Sinai holds two panels.
      '**The mirrored portraits shown above are modern comparisons** created from the two sides of the original face. They make the asymmetry easier to see, but they are not separate images found in the original icon.',
    ],
  },
  {
    id: 'mercy',
    eyebrow: 'THE TWO SIDES',
    title: 'Mercy and judgment',
    // Amber — the morning hour's, for the page about the open hand.
    accent: '#D97706',
    lit: '#F5BE72',
    // The two things the page is about, standing side by side: the hand
    // that opens outward, and the book held in against the body.
    figure: 'hands',
    caption: 'The hand that opens, and the book held close.',
    body: [
      // [GEN] one half read as mercy and grace, the other as the judge of
      // unrepentant sinners.
      'The two sides of the icon may also express two inseparable aspects of Christ’s relationship with humanity: **mercy and righteous judgment**.',
      // [SIN] the right hand (viewer's left) opens outward in blessing.
      'On **Christ’s right side** — the left side as seen by the viewer — His hand is raised openly in blessing. This side appears brighter and gentler and can be associated with mercy, welcome, healing, and the invitation to approach Him.',
      // [SIN] the left arm (viewer's right) clutches the Gospel book.
      'On **Christ’s left side** — the right side as seen by the viewer — He holds the Gospel book close to His body. This side appears more solemn and can be associated with truth, authority, and judgment. The same Gospel that offers life also reveals the truth by which human actions are judged.',
      // Matthew 25:31–46 — the sheep at the right hand, the goats at the left.
      'This right-and-left symbolism recalls **Christ’s description of the Last Judgment**, when those welcomed into the Kingdom are placed at His right and those who reject His way are placed at His left. The icon does not show two different versions of Christ — one loving and one cruel. It reveals one Christ whose mercy is inseparable from truth and whose judgment is perfectly just.',
      'He is the One who came to save humanity and the One who will come again to judge the living and the dead.',
    ],
  },
  {
    id: 'meaning',
    eyebrow: 'WHAT IT SHOWS',
    title: 'The meaning of the icon',
    accent: '#10B981',
    lit: '#7FE0C0',
    // ⚠ THE WHOLE BOARD AGAIN, and that repetition is the point. This
    // page names the hand, the book, the eyes, the halo and the robe in
    // turn, so the figure it wants is the one where all five can be
    // found at once. The sheet opens on the whole icon and closes on it.
    figure: 'panel',
    body: [
      // [SIN] "His right hand is shown opening outward, signifying his gift of
      // blessing." [GEN] the same hand is the conventional rhetorical gesture
      // representing teaching.
      'Christ raises His right hand in an ancient gesture of **speaking, teaching, and blessing**. The gesture presents Him as the Teacher who reveals divine truth and as the Lord who extends His blessing toward the viewer.',
      // [SIN] "the left hand and arm are clutching a thick Gospel book."
      // [GEN] a closed book with a richly decorated cover.
      'In His left hand, He holds **a large Gospel book decorated with precious stones**. The book represents His teaching and the divine word proclaimed to the world. Its richness expresses the immeasurable value of the truth it contains. It also signifies Christ’s authority as Lord and Judge, because His word both calls humanity toward life and reveals what is true.',
      'Christ’s nearly frontal position brings Him close to the viewer, while **His large, attentive eyes** create a sense of direct encounter. His gaze is calm but penetrating. It offers neither simple reassurance nor cold condemnation; it joins compassion with seriousness and mercy with authority.',
      // [GEN] some examples of the type carry a cruciform halo. ⚠ Nothing is
      // claimed here about lettering inside it — see the file header.
      '**The golden cross-shaped halo** proclaims Christ’s holiness and divine glory while recalling the Cross through which He entered suffering and conquered death. His deep purple garments also convey dignity and royal authority.',
      'Every part of the icon leads toward the same vision.',
    ],
    // ⚠ THE LAST SENTENCE OF THE SHEET, LIFTED OUT OF THE PARAGRAPH IT
    // ENDED. It was the closing line of five pages of writing set at the
    // same size as the sentence about panel thickness, so it landed as
    // one more clause. Given its own measure it lands as an ending —
    // and the paragraph above keeps its opening half, so nothing here is
    // said twice and nothing is lost.
    envoi:
      'Christ is the merciful Saviour, the divine Teacher, the righteous Judge, and the Ruler of All.',
  },
];

/**
 * Shown once at the foot of the last slide.
 *
 * ⚠ IT NAMES BOTH KINDS OF STATEMENT, because the sheet makes both.
 * Claiming the whole thing came from two encyclopaedia articles would be
 * untrue of the last three slides, and claiming none of it did would
 * throw away the one part a reader can go and check.
 */
export const PANTOCRATOR_SOURCE_NOTE =
  'Historical details from the Wikipedia articles “Christ Pantocrator” and “Christ Pantocrator (Sinai)”. The reading of the image follows the Christian tradition.';

/** What the two mirrored composites are called, in the order they are shown. */
export const PANTOCRATOR_FACE_LABELS = {
  // ⚠ Named as the control names it. "THE ICON" under a crop of the face
  // says the crop is the icon, and the icon is the whole board.
  whole: 'AS PAINTED',
  // The viewer's left half, mirrored into a whole face. [GEN] mercy and grace;
  // [SIN] the qualities of his human nature.
  mercy: 'MERCY',
  // The viewer's right half, mirrored. [GEN] the judge of unrepentant sinners;
  // [SIN] his divinity. ⚠ Spelled as slide four spells it.
  judgement: 'JUDGMENT',
} as const;

/** One line under the composite, naming what you are looking at. */
export const PANTOCRATOR_FACE_CAPTIONS = {
  whole: 'The face as it was painted — neither half repeated.',
  mercy: 'The left half of the face, mirrored into a whole one.',
  judgement: 'The right half of the face, mirrored into a whole one.',
} as const;

/** What the two states of the faces figure are called on the control. */
export const PANTOCRATOR_FACE_VIEWS = {
  halves: 'The two halves',
  whole: 'As painted',
} as const;

/**
 * The names under the two details on the Mercy and judgment page.
 *
 * ⚠ NAMED FOR WHAT THEY ARE, NOT FOR WHAT THEY MEAN. "Mercy" under a
 * photograph of a hand would be telling the reader the conclusion before
 * the paragraph has made the case, and the case is an interpretation —
 * see the header. The prose beside them does the reading.
 */
export const PANTOCRATOR_DETAIL_LABELS = {
  hand: 'The open hand',
  book: 'The Gospel book',
} as const;
