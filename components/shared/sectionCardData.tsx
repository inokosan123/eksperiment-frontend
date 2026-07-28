import { ComponentType, ReactNode } from 'react';
import {
  Book,
  CalendarHeart,
  Cross,
  Crown,
  Feather,
  Heart,
  HourGlass,
  Leaf,
  ListChecks,
  Notebook,
  OpenBook,
  Star,
  Target,
} from '@/components/icons/Icons';

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
  decor: <OpenBook s={84} c="#B54155" w={1} />,
  Decor: OpenBook,
  decorColor: '#B54155',
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
  decor: <Star s={84} c="#A9863F" w={1} />,
  Decor: Star,
  decorColor: '#A9863F',
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
  decor: <Notebook s={84} c="#5B564F" w={1} />,
  Decor: Notebook,
  decorColor: '#5B564F',
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
  decor: <Book s={84} c="#4B8152" w={1} />,
  Decor: Book,
  decorColor: '#4B8152',
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
  decor: <Feather s={84} c="#57534E" w={1} />,
  Decor: Feather,
  decorColor: '#78716C',
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
  decor: <ListChecks s={84} c="#15803D" w={1} />,
  Decor: ListChecks,
  decorColor: '#4B8152',
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
  decor: <Notebook s={84} c="#B45309" w={1} />,
  Decor: Notebook,
  decorColor: '#A9863F',
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
  decor: <Heart s={84} c="#7F1D1D" w={1} />,
  Decor: Heart,
  decorColor: '#B54155',
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
  decor: <Leaf s={84} c="#3D8273" w={1} />,
  Decor: Leaf,
  decorColor: '#3D8273',
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
  decor: <Star s={84} c="#4B8152" w={1} />,
  Decor: Star,
  decorColor: '#4B8152',
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
  decor: <Target s={84} c="#3D8273" w={1} />,
  Decor: Target,
  decorColor: '#3D8273',
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
  decor: <CalendarHeart s={84} c="#B54155" w={1} />,
  Decor: CalendarHeart,
  decorColor: '#B54155',
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
  decor: <HourGlass s={84} c="#4F46E5" w={1} />,
  Decor: HourGlass,
  decorColor: '#4F46E5',
  route: '/focus-zone',
};

export const CHALLENGES_CARD: SectionCardConfig = {
  id: 'challenges',
  label: 'SACRED EFFORTS',
  title: 'Challenges',
  description: 'Challenge yourself to grow, build discipline, and become a better version of yourself.',
  bg: '#FBF3DE',
  border: '#F0E3B8',
  labelColor: '#A9863F',
  titleColor: '#6D4F13',
  bodyColor: '#A9863F',
  arrowBg: '#8A5A1A',
  decor: <Crown s={84} c="#B45309" w={1} />,
  Decor: Crown,
  decorColor: '#A9863F',
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
