import { ReactNode } from 'react';
import { Clock, Eye, Shield, X } from '@/components/icons/Icons';

export type FocusRoute = '/protect-time' | '/clean-sight' | '/never-allowed' | '/strict-watch';

export type FocusHeroCard = {
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
  route: FocusRoute;
};

export const PROTECT_TIME_CARD: FocusHeroCard = {
  id: 'protect-time',
  label: 'APP BLOCKING',
  title: 'Protect Time',
  description: 'Guard your hours from the apps that pull you away.',
  bg: '#FBF3DE',
  border: '#F0E3B8',
  labelColor: '#A9863F',
  titleColor: '#6D4F13',
  bodyColor: '#A9863F',
  arrowBg: '#8A5A1A',
  decor: <Clock s={84} c="#A9863F" w={1} />,
  route: '/protect-time',
};

export const CLEAN_SIGHT_CARD: FocusHeroCard = {
  id: 'clean-sight',
  label: 'WEBSITE BLOCKING',
  title: 'Clean Sight',
  description: 'Close the door on gambling, adult and addictive sites.',
  bg: '#E1F1EC',
  border: '#C8E6DD',
  labelColor: '#3D8273',
  titleColor: '#1F4E45',
  bodyColor: '#3D8273',
  arrowBg: '#2A6E5F',
  decor: <Eye s={84} c="#3D8273" w={1} />,
  route: '/clean-sight',
};

export const FOCUS_HERO_CARDS = [PROTECT_TIME_CARD, CLEAN_SIGHT_CARD];

export type FocusPlaceholderConfig = {
  barTitle: string;
  label: string;
  title: string;
  description: string;
  tint: string;
  tintBg: string;
  icon: ReactNode;
};

export const PROTECT_TIME_PLACEHOLDER: FocusPlaceholderConfig = {
  barTitle: 'PROTECT TIME',
  label: 'APP BLOCKING',
  title: 'Protect Time',
  description:
    'Choose the apps that pull you away, set watches and schedules, and let a prayer stand between you and the habit.',
  tint: '#A9863F',
  tintBg: '#FBF3DE',
  icon: <Clock s={30} c="#A9863F" w={1.6} />,
};

export const CLEAN_SIGHT_PLACEHOLDER: FocusPlaceholderConfig = {
  barTitle: 'CLEAN SIGHT',
  label: 'WEBSITE BLOCKING',
  title: 'Clean Sight',
  description:
    'Close the door on gambling, adult and addictive websites — across your browsers, with lists you control.',
  tint: '#3D8273',
  tintBg: '#E1F1EC',
  icon: <Eye s={30} c="#3D8273" w={1.6} />,
};

export const NEVER_ALLOWED_PLACEHOLDER: FocusPlaceholderConfig = {
  barTitle: 'NEVER ALLOWED',
  label: 'ALWAYS BLOCKED',
  title: 'Never Allowed',
  description:
    'Doors you have chosen to keep closed for good. No sessions, no exceptions, no unlock.',
  tint: '#B54155',
  tintBg: '#FBE6E9',
  icon: <X s={28} c="#B54155" w={2} />,
};

export const STRICT_WATCH_PLACEHOLDER: FocusPlaceholderConfig = {
  barTitle: 'STRICT WATCH',
  label: 'NO EASY WAY OUT',
  title: 'Strict Watch',
  description:
    'Cooldowns, uninstall protection and firm limits — so a moment of weakness cannot undo your resolve.',
  tint: '#8B6B2F',
  tintBg: '#F5ECD7',
  icon: <Shield s={28} c="#8B6B2F" w={1.8} />,
};
