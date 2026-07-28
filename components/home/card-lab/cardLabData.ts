import type { ComponentType } from 'react';
import { CalendarHeart, CheckSmall, Crown, Target } from '@/components/icons/Icons';

/**
 * The lab's own copy of the four Organize cards.
 *
 * This deliberately does NOT import from `@/components/shared/sectionCardData`.
 * That file hands its watermark over as an already-rendered element locked to
 * one size, which a design lab cannot re-size — and, more importantly, editing
 * it would change the real Home, Library and Inner screens. Everything here is
 * a private copy: change any of it freely.
 */

export type LabIcon = ComponentType<{ s?: number; c?: string; w?: number }>;

export type LabCard = {
  id: string;
  label: string;
  title: string;
  description: string;
  /** Card tint and its hairline. */
  bg: string;
  border: string;
  /** Type colours. */
  labelColor: string;
  titleColor: string;
  bodyColor: string;
  /** The filled affordance's ground. */
  arrowBg: string;
  /** The watermark, as a component so each variant picks its own size. */
  Decor: LabIcon;
  decorColor: string;
};

export const LAB_CARDS: LabCard[] = [
  {
    id: 'challenges',
    label: 'SACRED EFFORTS',
    title: 'Challenges',
    description: 'Take on something hard for a set run of days: forty off social media, say. Finishing proves you can.',
    bg: '#FBF3DE',
    border: '#F0E3B8',
    labelColor: '#A9863F',
    // Gold, not orange. The app's gold family sits at hue 39–40; the burnt
    // orange this used to carry sat at 26, which is why it read as a
    // different app's colour beside the rest of the set.
    titleColor: '#6D4F13',
    bodyColor: '#A9863F',
    arrowBg: '#8B6B2F',
    Decor: Crown,
    decorColor: '#C5A059',
  },
  {
    id: 'habits',
    label: 'DAILY RHYTHM',
    title: 'Habits',
    description: 'Pick a goal, then the small daily steps that get you there. Anasta puts them on your day and counts each one.',
    bg: '#E6EEE7',
    border: '#CFE0D1',
    labelColor: '#4B8152',
    titleColor: '#1E4E27',
    bodyColor: '#4B8152',
    arrowBg: '#2C6A36',
    Decor: CheckSmall,
    decorColor: '#15803D',
  },
  {
    id: 'big-events',
    label: 'COMING DAYS',
    title: 'Big Events',
    description: 'Add the dates that matter, like a birthday or an exam. Anasta counts them down so none surprise you.',
    bg: '#FBE6E9',
    border: '#F5CDD3',
    labelColor: '#B54155',
    titleColor: '#7F1B2D',
    bodyColor: '#B54155',
    arrowBg: '#8C2636',
    Decor: CalendarHeart,
    decorColor: '#B54155',
  },
  {
    id: 'monthly-goals',
    label: 'MONTHLY AIM',
    title: 'Monthly Goals',
    description: 'Write down what you want finished this month. Seeing it every day keeps the month from slipping past.',
    bg: '#E1F1EC',
    border: '#C8E6DD',
    labelColor: '#3D8273',
    titleColor: '#1F4E45',
    bodyColor: '#3D8273',
    arrowBg: '#2A6E5F',
    Decor: Target,
    decorColor: '#3D8273',
  },
];

/** Mix a tint toward white — used by variants that want a lighter gradient end. */
export function mixWhite(hex: string, amount: number): string {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return '#FFFFFF';
  const r = Math.round(((n >> 16) & 255) * (1 - amount) + 255 * amount);
  const g = Math.round(((n >> 8) & 255) * (1 - amount) + 255 * amount);
  const b = Math.round((n & 255) * (1 - amount) + 255 * amount);
  return `rgb(${r},${g},${b})`;
}
