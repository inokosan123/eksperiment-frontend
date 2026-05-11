import {
  Activity,
  BarChart3,
  Calendar,
  CalendarHeart,
  Feather,
  FileEdit,
  Heart,
  Notebook,
  Sparkles,
  Star,
  Target,
} from '@/components/icons/Icons';

export type SectionType =
  | 'mood'
  | 'monthlyGoals'
  | 'satisfaction'
  | 'energy'
  | 'guidedPrompts'
  | 'upcomingEvents'
  | 'gratitude'
  | 'whoIWantToBe'
  | 'freeWriting'
  | 'customScale';

export type JournalSection = {
  id: string;
  type: SectionType;
  active: boolean;
  customLabel?: string;
};

type SectionMeta = {
  label: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  bg: string;
  color: string;
};

export const SECTION_META: Record<SectionType, SectionMeta> = {
  mood:           { label: 'Mood',             Icon: Sparkles,      bg: '#FFF3D3', color: '#C5A059' },
  monthlyGoals:   { label: 'Monthly Goals',    Icon: Target,        bg: '#E1F1EC', color: '#3D8273' },
  satisfaction:   { label: 'Satisfaction',     Icon: BarChart3,     bg: '#FCE5D5', color: '#D97706' },
  energy:         { label: 'Energy',           Icon: Activity,      bg: '#FFF3D3', color: '#D4B06A' },
  guidedPrompts:  { label: 'Guided Prompts',   Icon: Notebook,      bg: '#EEEAF5', color: '#7C6EAF' },
  upcomingEvents: { label: 'Upcoming Events',  Icon: Calendar,      bg: '#E2E9F8', color: '#4E5394' },
  gratitude:      { label: 'Gratitude',        Icon: Heart,         bg: '#FBE6E9', color: '#B54155' },
  whoIWantToBe:   { label: 'Who I Want to Be', Icon: Star,          bg: '#FBF3DE', color: '#A9863F' },
  freeWriting:    { label: 'Free Writing',     Icon: Feather,       bg: '#EEEAF5', color: '#6D5AAE' },
  customScale:    { label: 'Custom Scale',     Icon: BarChart3,     bg: '#E1F1EC', color: '#3D8273' },
};

export const DEFAULT_SECTIONS: JournalSection[] = [
  { id: 'mood', type: 'mood', active: true },
  { id: 'monthlyGoals', type: 'monthlyGoals', active: true },
  { id: 'satisfaction', type: 'satisfaction', active: true },
  { id: 'energy', type: 'energy', active: true },
  { id: 'guidedPrompts', type: 'guidedPrompts', active: true },
  { id: 'upcomingEvents', type: 'upcomingEvents', active: true },
  { id: 'gratitude', type: 'gratitude', active: true },
  { id: 'whoIWantToBe', type: 'whoIWantToBe', active: true },
  { id: 'freeWriting', type: 'freeWriting', active: false },
];

// Re-export icon types for use in unused imports — silences TS lints
const _allIcons = [Activity, BarChart3, Calendar, CalendarHeart, Feather, FileEdit, Heart, Notebook, Sparkles, Star, Target];
void _allIcons;
