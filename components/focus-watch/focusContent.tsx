import { ReactNode } from 'react';
import { AlertTriangle, Bell, Clock, Eye, Target, Waves } from '@/components/icons/Icons';
import type { WebPackId } from './focusWatchStore';

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

export type WebPackContent = {
  id: WebPackId;
  name: string;
  detail: string;
  layerName: string;
  icon: ReactNode;
  iconBg: string;
};

export const WEB_PACKS: WebPackContent[] = [
  {
    id: 'gambling',
    name: 'Gambling & Betting',
    detail: 'Betting sites, casinos, lotteries',
    layerName: 'Gambling sites',
    icon: <Target s={16} c="#B54155" w={2} />,
    iconBg: '#FBE6E9',
  },
  {
    id: 'adult',
    name: 'Adult Content',
    detail: "Apple's system filter plus our curated list",
    layerName: 'Adult content',
    icon: <AlertTriangle s={15} c="#B54155" w={2} />,
    iconBg: '#FBE6E9',
  },
  {
    id: 'social',
    name: 'Social Web',
    detail: 'Feeds in the browser — X, Reddit, Facebook',
    layerName: 'Social web',
    icon: <Waves s={16} c="#3D8273" w={2} />,
    iconBg: '#E1F1EC',
  },
  {
    id: 'news',
    name: 'News & Doomscroll',
    detail: 'Endless headlines and comment wars',
    layerName: 'News sites',
    icon: <Bell s={15} c="#A9863F" w={2} />,
    iconBg: '#FBF3DE',
  },
];

export const WEB_PACK_LAYER_NAMES: Record<WebPackId, string> = Object.fromEntries(
  WEB_PACKS.map(pack => [pack.id, pack.layerName])
) as Record<WebPackId, string>;
