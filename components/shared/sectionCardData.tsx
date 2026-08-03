import { ComponentType, ReactNode } from 'react';
import { Cross } from '@/components/icons/Icons';
import AimTarget from '@/components/icons/AimTarget';
import AscentLadder from '@/components/icons/AscentLadder';
import BookStack from '@/components/icons/BookStack';
import EffortCrown from '@/components/icons/EffortCrown';
import EventCalendar from '@/components/icons/EventCalendar';
import DreamTrophy from '@/components/icons/DreamTrophy';
import FavoriteStar from '@/components/icons/FavoriteStar';
import FocusGlass from '@/components/icons/FocusGlass';
import GratefulHeart from '@/components/icons/GratefulHeart';
import JournalPen from '@/components/icons/JournalPen';
import NoteSlips from '@/components/icons/NoteSlips';
import NotesBook from '@/components/icons/NotesBook';
import ScriptureBook from '@/components/icons/ScriptureBook';
import SelfMirror from '@/components/icons/SelfMirror';

/* ─────────────────────────────────────────────────────────────
 * THE DRAWN EMBLEMS.
 *
 * Fourteen cards — four on Library, six on Inner Life, four in
 * Home's Organize block — carry a mark
 * DRAWN for emblem size rather than an icon-set glyph stretched to
 * it. See `components/icons/emblemStroke` for the method and
 * `components/icons/BeadLoop` for where it started.
 *
 * THEY ARE PLACED AS A SET, NOT ONE AT A TIME. Within a screen every
 * mark stands the same height of INK, lands its right edge 14pt in
 * from the plate — the arrow orb's own margin — and keeps 6pt of air
 * under it.
 *
 * · Library — 79pt.
 * · Inner Life — 74pt, held there by the mirror, which is the
 *   tallest-and-narrowest drawing of the set and tops out at 74.5.
 * · Home's Organize block — 76pt, and DELIBERATELY AIRIER than the
 *   others: 16pt in from the edge and 9pt of air beneath, against
 *   14 and 6 everywhere else. Pavle asked for these four to breathe
 *   more, and the extra air is what costs it the 3pt against
 *   Library. The four are never on screen with Library.
 *
 * The heights are solved, not chosen: sample each mark's outer
 * boundary, rotate it by the card's -8°, and test every point
 * against the arrow orb's opaque disc, the plate's 26pt corner
 * radius and all four clipped edges, at every card width from 300
 * to 430. A set moves at the pace of its slowest member, or it
 * stops being a set. The two screens differ by 5pt and are never on
 * screen together.
 *
 * ⚠ NONE OF THE THREE NUMBERS BELOW IS THE ONE YOU SEE. `size` is the
 * drawing's BOX, and `right`/`bottom` position that box — but the
 * rotation swings each drawing's corners a different distance past
 * its own grid, so equal boxes do not give equal marks and an equal
 * `bottom` does not give equal air. All three are solved backwards
 * from where the INK has to land, which is why they look arbitrary
 * and disagree between cards. Do not "tidy" them into round
 * numbers, and do not copy one card's values to another.
 *
 * (This was got wrong once: `right` was solved from the ink while
 * `bottom` was left as a raw 6 on every card, and the real air under
 * the ten marks ranged from 4.7 to 10.4pt.)
 *
 * ⚠ THE CARD COPY IS PART OF THIS GEOMETRY. These marks are sized
 * against the plate height each description produces; rewriting a
 * description to one line moves the plate's foot up under the mark.
 * If you shorten one, re-solve before shipping it.
 *
 * ⚠ AND SO IS THE DRAWING'S OWN viewBox. An <Svg> clips to it, so a
 * crest or a foot laid outside 0..24 is silently not drawn — that
 * happened once to `SelfMirror`, whose crest sat at y = -0.1.
 * ───────────────────────────────────────────────────────────── */

export type SectionCardRoute =
  | '/prayer'
  | '/scripture'
  | '/favorites'
  | '/bible-notes'
  | '/reading-list'
  | '/journal'
  | '/habits'
  | '/notes'
  | '/gratitude'
  | '/ideal-self'
  | '/bucket-list'
  | '/monthly-goals'
  | '/big-events'
  | '/focus-zone'
  | '/challenges';

export type SectionCardConfig = {
  id: string;
  label: string;
  title: string;
  description: string;
  bg: string;
  border: string;
  labelColor: string;
  titleColor: string;
  bodyColor: string;
  arrowBg: string;
  decor: ReactNode;
  decorUpright?: boolean;
  /**
   * The same emblem as `decor`, but handed over as a COMPONENT rather than
   * an already-rendered element, so a card design can choose its own size.
   * `decor` is locked to 84 the moment it is written, which is fine for the
   * original card and useless to one that wants the mark large.
   *
   * Optional: only the cards a re-designed screen renders need it.
   */
  Decor?: SectionCardIcon;
  decorColor?: string;
  /**
   * Where the emblem stands, for a mark the default geometry is wrong for.
   *
   * `ribbonEmblem()` sizes the mark at 46% of the plate and hangs it off the
   * right edge and the foot, which is right for a mark that survives being
   * cropped — a star, a cross, a heart. A drawn illustration with a bottom to
   * it does not survive: `ScriptureBook`'s marker would simply be cut away.
   * Such a card pulls its mark in off both edges and stands it whole.
   *
   * ⚠ Opt-in and per-field. Both card screens spread the whole config into
   * `RibbonSectionCard`, so this reaches the card with no other change.
   */
  decorPlacement?: { size?: number; right?: number; bottom?: number; rest?: number };
  route: SectionCardRoute;
};

export type SectionCardIcon = ComponentType<{ s?: number; c?: string; w?: number }>;

export const PRAYER_BOOK_CARD: SectionCardConfig = {
  id: 'prayer-book',
  label: 'RULE OF PRAYER',
  title: 'Prayer Book',
  description: 'Guide your day with morning, evening, and mealtime prayers.',
  bg: '#EEEAF5',
  border: '#DDD5ED',
  labelColor: '#6D5AAE',
  titleColor: '#3B2F76',
  bodyColor: '#6D5AAE',
  arrowBg: '#2E2478',
  decor: <Cross s={84} c="#6D5AAE" w={1} />,
  Decor: Cross,
  decorColor: '#6D5AAE',
  decorUpright: true,
  route: '/prayer',
};

export const HOLY_SCRIPTURE_CARD: SectionCardConfig = {
  id: 'holy-scripture',
  label: 'BIBLE & PSALMS',
  title: 'Holy Scripture',
  description: 'Read the Bible and Psalms, and let the Word of God shape your day.',
  bg: '#FBE6E9',
  border: '#F5CDD3',
  labelColor: '#B54155',
  titleColor: '#7F1B2D',
  bodyColor: '#B54155',
  arrowBg: '#8C2636',
  decor: <ScriptureBook s={81} c="#B54155" w={1} />,
  // A drawn Gospel — closed board, tooled frame, the cross on the cover, the
  // four Evangelists at the corners and the marker falling from between the
  // boards — rather than the icon set's two-path `OpenBook` blown up to 150pt.
  // See `ScriptureBook` for why the old mark was empty at emblem size.
  Decor: ScriptureBook,
  decorColor: '#B54155',
  // NOT upright: a cross DEPICTED ON an object tilts with the object, so this
  // mark keeps the family's -8° where the bare two-line `Cross` cannot.
  //
  // `size` is the emblem's HEIGHT — the mark draws three quarters as wide,
  // being a portrait book. 61×79pt of ink.
  decorPlacement: { size: 81, right: 12.1, bottom: 5.8, rest: 0.3 },
  route: '/scripture',
};

export const FAVORITES_CARD: SectionCardConfig = {
  id: 'favorites',
  label: 'HIGHLIGHTS & NOTES',
  title: 'My Favorites',
  description: 'Keep your saved verses, highlights, and reflections from Scripture in one place.',
  bg: '#FBF3DE',
  border: '#F0E3B8',
  labelColor: '#A9863F',
  titleColor: '#6D4F13',
  bodyColor: '#A9863F',
  arrowBg: '#8A5A1A',
  decor: <FavoriteStar s={82} c="#A9863F" w={1} />,
  // Four points with hollowed flanks, piercing a tooled ring set with the
  // Gospel's own four bosses — not the icon set's five-pointed outline, which
  // at emblem size is a rating badge with nothing in it.
  Decor: FavoriteStar,
  decorColor: '#A9863F',
  // Square, so at the set's 79pt height it is also 79 across — the widest of
  // the four, which is right: a star IS wider than a book. Its own ceiling is
  // 110; it is held down to the family's height.
  decorPlacement: { size: 82, right: 12.3, bottom: 4.3, rest: 0.3 },
  route: '/favorites',
};

export const BIBLE_NOTES_CARD: SectionCardConfig = {
  id: 'bible-notes',
  label: 'STUDY REFLECTIONS',
  title: 'Bible Notes',
  description: 'Capture observations, lessons, and personal application as you study each chapter.',
  bg: '#EFEEEB',
  border: '#DEDCD6',
  labelColor: '#5B564F',
  titleColor: '#1C1917',
  bodyColor: '#5B564F',
  arrowBg: '#1C1917',
  decor: <NotesBook s={82} c="#5B564F" w={1} />,
  // A bound notebook with the cross written at the head of the page, where one
  // actually goes. The bound edge, the margin rule and the ruled hand are what
  // keep it from reading as a second Gospel two cards up the shelf.
  Decor: NotesBook,
  decorColor: '#5B564F',
  // 63×79pt.
  decorPlacement: { size: 82, right: 12.8, bottom: 3.9, rest: 0.3 },
  route: '/bible-notes',
};

export const READING_LIST_CARD: SectionCardConfig = {
  id: 'reading-list',
  label: 'PERSONAL LIBRARY',
  title: 'Reading List',
  description: "Keep track of what you're reading, set goals, and save notes along the way.",
  bg: '#E6EEE7',
  border: '#CFE0D1',
  labelColor: '#4B8152',
  titleColor: '#1E4E27',
  bodyColor: '#4B8152',
  arrowBg: '#2C6A36',
  decor: <BookStack s={81} c="#4B8152" w={1} />,
  // Three volumes, not one: a reading list is by definition more than one book,
  // and the Scripture card two rows up already owns "a book".
  Decor: BookStack,
  decorColor: '#4B8152',
  // 76×78pt — a point short of the set, because rounding `size` to a whole
  // number put the exact solution 0.4pt over the plate's corner. Its inset runs
  // ~10 rather than ~12 because the marker rides out of the top volume, so the
  // ink reaches further right than the boards do.
  decorPlacement: { size: 81, right: 9.9, bottom: 7.3, rest: 0.3 },
  route: '/reading-list',
};

export const JOURNAL_CARD: SectionCardConfig = {
  id: 'journal',
  label: 'DAILY REFLECTION',
  title: 'Journal',
  description: 'Capture daily to-dos, reflect on your progress, and keep growing.',
  bg: '#EFEEEB',
  border: '#DEDCD6',
  labelColor: '#78716C',
  titleColor: '#0C0A09',
  bodyColor: '#57534E',
  arrowBg: '#1C1917',
  decor: <JournalPen s={74} c="#57534E" w={1} />,
  // The book open and WRITTEN IN — a heading with a rule under it, the entry
  // set below, and a fountain pen laid alongside. The underline is the point:
  // five bare lines of hand are a page of anything, but a heading ruled off
  // above a body is a dated entry, which only a journal has.
  Decor: JournalPen,
  decorColor: '#78716C',
  decorPlacement: { size: 74, right: 8.1, bottom: 7.6, rest: 0.3 },
  route: '/journal',
};

export const HABITS_CARD: SectionCardConfig = {
  id: 'habits',
  label: 'DAILY RHYTHM',
  title: 'Habits',
  description: 'Set clear goals and build the habits that will help you achieve them.',
  bg: '#E6EEE7',
  border: '#CFE0D1',
  labelColor: '#4B8152',
  titleColor: '#1E4E27',
  bodyColor: '#4B8152',
  arrowBg: '#2C6A36',
  decor: <AscentLadder s={78} c="#15803D" w={1} />,
  // A ladder, not a checklist — `NotesBook` and `NoteSlips` already own the
  // list, and a habit is not a list but the same step taken again. The Ladder
  // of Divine Ascent is that, and belongs to this app rather than to
  // productivity software. The rungs are the rhythm.
  Decor: AscentLadder,
  decorColor: '#4B8152',
  decorPlacement: { size: 78, right: 12.1, bottom: 11.2, rest: 0.3 },
  route: '/habits',
};

export const NOTES_CARD: SectionCardConfig = {
  id: 'notes',
  label: 'SELF-CORRECTION',
  title: 'Notes',
  description: 'Keep honest notes and practical reminders for when you need them most.',
  bg: '#FBF3DE',
  border: '#F0E3B8',
  labelColor: '#A9863F',
  titleColor: '#6D4F13',
  bodyColor: '#A9863F',
  arrowBg: '#8A5A1A',
  decor: <NoteSlips s={73} c="#B45309" w={1} />,
  // Loose dog-eared slips, not a notebook — Bible Notes took the bound volume,
  // and of the two this is the card that should give it up: SELF-CORRECTION is
  // a reminder kept for when you need it, which is a slip.
  Decor: NoteSlips,
  decorColor: '#A9863F',
  decorPlacement: { size: 73, right: 8.5, bottom: 6.6, rest: 0.3 },
  route: '/notes',
};

export const GRATITUDE_CARD: SectionCardConfig = {
  id: 'gratitude',
  label: 'GIVE THANKS',
  title: 'Gratitude',
  description: "Notice God's gifts, record your blessings, and give thanks each day.",
  bg: '#FBE6E9',
  border: '#F5CDD3',
  labelColor: '#B54155',
  titleColor: '#7F1B2D',
  bodyColor: '#B54155',
  arrowBg: '#5E1E1E',
  decor: <GratefulHeart s={90} c="#7F1D1D" w={1} />,
  // A heart with light coming down on it. A bare heart says love; the card says
  // "notice God's gifts and give thanks", and the fan of five is what carries
  // the difference.
  Decor: GratefulHeart,
  decorColor: '#B54155',
  decorPlacement: { size: 90, right: 3.4, bottom: 3.3, rest: 0.3 },
  route: '/gratitude',
};

export const IDEAL_SELF_CARD: SectionCardConfig = {
  id: 'ideal-self',
  label: 'WHO I WANT TO BE',
  title: 'Ideal Self',
  description: 'Define the qualities you are trying to live and check them honestly each day.',
  bg: '#E1F1EC',
  border: '#C8E6DD',
  labelColor: '#3D8273',
  titleColor: '#1F4E45',
  bodyColor: '#3D8273',
  arrowBg: '#2A6E5F',
  decor: <SelfMirror s={76} c="#3D8273" w={1} />,
  // A looking-glass, on the card's own copy: "check them honestly each day" is
  // self-examination, and the leaf sat one screen from three other green
  // growing things. The two struck arcs are the whole mark — without them it
  // is an empty oval on a stick.
  Decor: SelfMirror,
  decorColor: '#3D8273',
  // 0.2 is not a typo: the mirror is narrow inside a square grid, so its box
  // has to stand almost on the plate's edge to land its INK on the same 14.
  decorPlacement: { size: 76, right: 0.2, bottom: 5.8, rest: 0.3 },
  route: '/ideal-self',
};

export const BUCKET_LIST_CARD: SectionCardConfig = {
  id: 'bucket-list',
  label: 'LIFE DREAMS',
  title: 'Bucket List',
  description: 'Keep track of your life goals and celebrate achievements.',
  bg: '#E6EEE7',
  border: '#CFE0D1',
  labelColor: '#4B8152',
  titleColor: '#1E4E27',
  bodyColor: '#4B8152',
  arrowBg: '#2C6A36',
  decor: <DreamTrophy s={84} c="#4B8152" w={1} />,
  // The card wears what the dream earns. Its rim is an ELLIPSE, which is the
  // one curve that gives the cup its volume, and the bowl is fluted rather
  // than starred — `FavoriteStar` already owns the star. See `DreamTrophy`.
  Decor: DreamTrophy,
  decorColor: '#4B8152',
  decorPlacement: { size: 84, right: 0.7, bottom: 4, rest: 0.3 },
  route: '/bucket-list',
};

export const MONTHLY_GOALS_CARD: SectionCardConfig = {
  id: 'monthly-goals',
  label: 'MONTHLY AIM',
  title: 'Monthly Goals',
  description: 'Set clear goals for the month and stay on track with what you want to achieve.',
  bg: '#E1F1EC',
  border: '#C8E6DD',
  labelColor: '#3D8273',
  titleColor: '#1F4E45',
  bodyColor: '#3D8273',
  arrowBg: '#2A6E5F',
  decor: <AimTarget s={88} c="#3D8273" w={1} />,
  // The target with the AIMING put back: three bare rings are a diagram, and
  // an arrow in the middle is a month that was hit. The arrow is also what
  // keeps it clear of `FavoriteStar`, which is likewise a ring with things set
  // on it.
  Decor: AimTarget,
  decorColor: '#3D8273',
  decorPlacement: { size: 88, right: 19.1, bottom: 1.9, rest: 0.3 },
  route: '/monthly-goals',
};

export const BIG_EVENTS_CARD: SectionCardConfig = {
  id: 'big-events',
  label: 'COMING DAYS',
  title: 'Big Events',
  description: 'Track important dates, countdowns, and moments you are preparing for.',
  bg: '#FBE6E9',
  border: '#F5CDD3',
  labelColor: '#B54155',
  titleColor: '#7F1B2D',
  bodyColor: '#B54155',
  arrowBg: '#8C2636',
  decor: <EventCalendar s={80} c="#B54155" w={1} />,
  // The calendar was right; the heart was borrowed from a card two screens
  // away that is actually about the heart. This one is about a DATE — hung
  // from two rings, landscape, with one day ringed on the grid.
  Decor: EventCalendar,
  decorColor: '#B54155',
  decorPlacement: { size: 80, right: 15.1, bottom: 8.6, rest: 0.3 },
  route: '/big-events',
};

export const FOCUS_ZONE_CARD: SectionCardConfig = {
  id: 'focus-zone',
  label: 'STUDY TIMER',
  title: 'Focus Zone',
  description: 'Use a Pomodoro timer to stay focused and get more things done.',
  bg: '#E8EAFB',
  border: '#D4D9F2',
  labelColor: '#4F46E5',
  titleColor: '#1E1B4B',
  bodyColor: '#4F46E5',
  arrowBg: '#312E81',
  decor: <FocusGlass s={76} c="#4F46E5" w={1} />,
  // The same hourglass, caught mid-run. Each wall is now ONE curve from head
  // to foot rather than four meeting at the middle, the posts are beams, and
  // the sand is dished where it is running out — see `FocusGlass`.
  Decor: FocusGlass,
  decorColor: '#4F46E5',
  decorPlacement: { size: 76, right: 7.5, bottom: 5.2, rest: 0.3 },
  route: '/focus-zone',
};

export const CHALLENGES_CARD: SectionCardConfig = {
  id: 'challenges',
  label: 'SACRED EFFORTS',
  title: 'Challenges',
  // ⚠ Kept to two lines on purpose. At 86 characters this was the only card in
  // the app that wrapped to three, which made its plate 23pt taller than its
  // three neighbours and broke the row's rhythm. The triad is intact —
  // challenge, discipline, growth — only "become a better version of yourself"
  // is said in fewer words. See the note at the head of this file: the copy is
  // part of the emblem geometry, and this length was measured, not guessed.
  description: 'Challenge yourself, build discipline, and grow into who you want to be.',
  bg: '#FBF3DE',
  border: '#F0E3B8',
  labelColor: '#A9863F',
  titleColor: '#6D4F13',
  bodyColor: '#A9863F',
  arrowBg: '#8A5A1A',
  decor: <EffortCrown s={81} c="#B45309" w={1} />,
  // SACRED EFFORTS: the crown is what the effort is for. NOT a trophy and not
  // a medallion — the app ranks those by rarity (trophy = the repeating unit,
  // on Bucket List; medallion = Focus), and a third cup here would collapse
  // that. A crown is received rather than won, which is the distinction.
  Decor: EffortCrown,
  decorColor: '#A9863F',
  decorPlacement: { size: 81, right: 7.7, bottom: 11, rest: 0.3 },
  route: '/challenges',
};

export const LIBRARY_SECTION_CARDS = [
  PRAYER_BOOK_CARD,
  HOLY_SCRIPTURE_CARD,
  FAVORITES_CARD,
  BIBLE_NOTES_CARD,
  READING_LIST_CARD,
];

export const INNER_SECTION_CARDS = [
  JOURNAL_CARD,
  FOCUS_ZONE_CARD,
  GRATITUDE_CARD,
  BUCKET_LIST_CARD,
  NOTES_CARD,
  IDEAL_SELF_CARD,
];

export const HOME_ORGANIZE_SECTION_CARDS = [
  CHALLENGES_CARD,
  HABITS_CARD,
  BIG_EVENTS_CARD,
  MONTHLY_GOALS_CARD,
];
