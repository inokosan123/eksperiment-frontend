import { ReactNode } from 'react';
import {
  Book,
  CheckSmall,
  Cross,
  Feather,
  Heart,
  HourGlass,
  Notebook,
  OpenBook,
  Star,
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
  | '/focus-zone';

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
  route: SectionCardRoute;
};

export const PRAYER_BOOK_CARD: SectionCardConfig = {
  id: 'prayer-book',
  label: 'RULE OF PRAYER',
  title: 'Prayer Book',
  description: 'Daily morning, evening, and mealtime prayers to guide your rhythm of life.',
  bg: '#EEEAF5',
  border: '#DDD5ED',
  labelColor: '#6D5AAE',
  titleColor: '#3B2F76',
  bodyColor: '#6D5AAE',
  arrowBg: '#2E2478',
  decor: <Cross s={128} c="#6D5AAE" w={1} />,
  route: '/prayer',
};

export const HOLY_SCRIPTURE_CARD: SectionCardConfig = {
  id: 'holy-scripture',
  label: 'BIBLE & PSALMS',
  title: 'Holy Scripture',
  description: 'The divinely inspired Word of God, including the Psalms of David.',
  bg: '#FBE6E9',
  border: '#F5CDD3',
  labelColor: '#B54155',
  titleColor: '#7F1B2D',
  bodyColor: '#B54155',
  arrowBg: '#8C2636',
  decor: <OpenBook s={128} c="#B54155" w={1} />,
  route: '/scripture',
};

export const FAVORITES_CARD: SectionCardConfig = {
  id: 'favorites',
  label: 'HIGHLIGHTS & NOTES',
  title: 'My Favorites',
  description: 'Your saved verses, highlights, and personal reflections from Scripture.',
  bg: '#FBF3DE',
  border: '#F0E3B8',
  labelColor: '#A9863F',
  titleColor: '#6D4F13',
  bodyColor: '#A9863F',
  arrowBg: '#8A5A1A',
  decor: <Star s={128} c="#A9863F" w={1} />,
  route: '/favorites',
};

export const BIBLE_NOTES_CARD: SectionCardConfig = {
  id: 'bible-notes',
  label: 'STUDY REFLECTIONS',
  title: 'Bible Notes',
  description: 'Your chapter notes - observations, lessons learned, and personal application.',
  bg: '#EFEEEB',
  border: '#DEDCD6',
  labelColor: '#5B564F',
  titleColor: '#1C1917',
  bodyColor: '#5B564F',
  arrowBg: '#1C1917',
  decor: <Notebook s={128} c="#5B564F" w={1} />,
  route: '/bible-notes',
};

export const READING_LIST_CARD: SectionCardConfig = {
  id: 'reading-list',
  label: 'PERSONAL LIBRARY',
  title: 'Reading List',
  description: "Track the books you're reading, set reading goals, and keep notes.",
  bg: '#E6EEE7',
  border: '#CFE0D1',
  labelColor: '#4B8152',
  titleColor: '#1E4E27',
  bodyColor: '#4B8152',
  arrowBg: '#2C6A36',
  decor: <Book s={128} c="#4B8152" w={1} />,
  route: '/reading-list',
};

export const JOURNAL_CARD: SectionCardConfig = {
  id: 'journal',
  label: 'DAILY REFLECTION',
  title: 'Journal',
  description: 'Capture your daily thoughts, spiritual struggles, and progress.',
  bg: '#F5F5F4',
  border: '#E7E5E4',
  labelColor: '#78716C',
  titleColor: '#0C0A09',
  bodyColor: '#57534E',
  arrowBg: '#1C1917',
  decor: <Feather s={128} c="#57534E" w={1} />,
  route: '/journal',
};

export const HABITS_CARD: SectionCardConfig = {
  id: 'habits',
  label: 'DAILY RHYTHM',
  title: 'Habits',
  description: 'Build consistent habits and track your daily progress.',
  bg: '#F0FDF4',
  border: '#DCFCE7',
  labelColor: 'rgba(20,83,45,0.42)',
  titleColor: '#052E16',
  bodyColor: 'rgba(20,83,45,0.72)',
  arrowBg: '#14532D',
  decor: <CheckSmall s={128} c="#15803D" w={1} />,
  route: '/habits',
};

export const NOTES_CARD: SectionCardConfig = {
  id: 'notes',
  label: 'SELF-CORRECTION',
  title: 'Notes',
  description: 'Short notes and advice to yourself for when you fall.',
  bg: '#FFFBEB',
  border: '#FEF3C7',
  labelColor: 'rgba(120,53,15,0.45)',
  titleColor: '#451A03',
  bodyColor: 'rgba(120,53,15,0.72)',
  arrowBg: '#78350F',
  decor: <Notebook s={128} c="#B45309" w={1} />,
  route: '/notes',
};

export const GRATITUDE_CARD: SectionCardConfig = {
  id: 'gratitude',
  label: 'GIVE THANKS',
  title: 'Gratitude',
  description: "A dedicated space to list blessings and God's daily mercy.",
  bg: '#FEF2F2',
  border: '#FEE2E2',
  labelColor: 'rgba(127,29,29,0.45)',
  titleColor: '#450A0A',
  bodyColor: 'rgba(127,29,29,0.72)',
  arrowBg: '#5E1E1E',
  decor: <Heart s={128} c="#7F1D1D" w={1} />,
  route: '/gratitude',
};

export const IDEAL_SELF_CARD: SectionCardConfig = {
  id: 'ideal-self',
  label: 'WHO I WANT TO BE',
  title: 'Ideal Self',
  description: 'Define the qualities you are trying to live and check them honestly each day.',
  bg: '#FFFBEB',
  border: '#FEF3C7',
  labelColor: 'rgba(120,53,15,0.45)',
  titleColor: '#451A03',
  bodyColor: 'rgba(120,53,15,0.72)',
  arrowBg: '#78350F',
  decor: <Star s={128} c="#B45309" w={1} />,
  route: '/ideal-self',
};

export const BUCKET_LIST_CARD: SectionCardConfig = {
  id: 'bucket-list',
  label: 'LIFE DREAMS',
  title: 'Bucket List',
  description: 'Keep track of your life goals and celebrate achievements.',
  bg: '#FFFBEB',
  border: '#FEF3C7',
  labelColor: 'rgba(120,53,15,0.45)',
  titleColor: '#451A03',
  bodyColor: 'rgba(120,53,15,0.72)',
  arrowBg: '#78350F',
  decor: <Star s={128} c="#B45309" w={1} />,
  route: '/bucket-list',
};

export const FOCUS_ZONE_CARD: SectionCardConfig = {
  id: 'focus-zone',
  label: 'STUDY TIMER',
  title: 'Focus Zone',
  description: 'Timer to help you focus deeply while reading or praying.',
  bg: '#EEF2FF',
  border: '#E0E7FF',
  labelColor: 'rgba(49,46,129,0.45)',
  titleColor: '#1E1B4B',
  bodyColor: 'rgba(49,46,129,0.72)',
  arrowBg: '#312E81',
  decor: <HourGlass s={128} c="#4F46E5" w={1} />,
  route: '/focus-zone',
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
  HABITS_CARD,
  NOTES_CARD,
  GRATITUDE_CARD,
  IDEAL_SELF_CARD,
  BUCKET_LIST_CARD,
  FOCUS_ZONE_CARD,
];

export const HOME_EXPLORE_SECTION_CARDS = [
  PRAYER_BOOK_CARD,
  NOTES_CARD,
  HOLY_SCRIPTURE_CARD,
  JOURNAL_CARD,
];
