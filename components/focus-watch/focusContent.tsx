import { ReactNode } from 'react';
import { AlertTriangle, Bell, Calendar, Eye, Target, Waves } from '@/components/icons/Icons';
import type { WebPackId } from './dayPlanStore';

export type FocusRoute = '/day-plans' | '/clean-sight';

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

export const DAY_PLAN_CARD: FocusHeroCard = {
  id: 'day-plan',
  label: 'APP BLOCKING',
  title: 'Day Plan',
  description: 'Plan your phone the way you plan your day.',
  bg: '#FBF3DE',
  border: '#F0E3B8',
  labelColor: '#A9863F',
  titleColor: '#6D4F13',
  bodyColor: '#A9863F',
  arrowBg: '#8A5A1A',
  decor: <Calendar s={84} c="#A9863F" w={1} />,
  route: '/day-plans',
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

export type WebPackContent = {
  id: WebPackId;
  name: string;
  detail: string;
  icon: ReactNode;
  iconBg: string;
  sites: string[];
  sitesNote: string;
};

export const WEB_PACKS: WebPackContent[] = [
  {
    id: 'gambling',
    name: 'Gambling & Betting',
    detail: 'Betting sites, casinos, lotteries',
    icon: <Target s={16} c="#B54155" w={2} />,
    iconBg: '#FBE6E9',
    sites: ['bet365.com', 'stake.com', '1xbet.com', 'williamhill.com', 'betway.com', 'pokerstars.com'],
    sitesNote: '…and a curated list we keep growing',
  },
  {
    id: 'adult',
    name: 'Adult Content',
    detail: "Apple's system filter plus our curated list",
    icon: <AlertTriangle s={15} c="#B54155" w={2} />,
    iconBg: '#FBE6E9',
    sites: ['pornhub.com', 'xvideos.com', 'onlyfans.com', 'xnxx.com', 'chaturbate.com'],
    sitesNote: "…plus Apple's automatic adult filter for the rest",
  },
  {
    id: 'social',
    name: 'Social Web',
    detail: 'Feeds in the browser — X, Reddit, Facebook',
    icon: <Waves s={16} c="#3D8273" w={2} />,
    iconBg: '#E1F1EC',
    sites: ['x.com', 'facebook.com', 'reddit.com', 'instagram.com', 'tiktok.com', 'threads.net'],
    sitesNote: '…the apps themselves live in your Day Plan',
  },
  {
    id: 'news',
    name: 'News & Doomscroll',
    detail: 'Endless headlines and comment wars',
    icon: <Bell s={15} c="#A9863F" w={2} />,
    iconBg: '#FBF3DE',
    sites: ['news.google.com', 'cnn.com', 'bbc.com', 'dailymail.co.uk', 'nypost.com'],
    sitesNote: '…and a curated list we keep growing',
  },
];

// Mock app catalog until Apple's FamilyActivityPicker arrives in Phase 2.
// Tints come from the section-card palette family.
export type MockApp = { id: string; name: string; categoryId: string };

export const CATEGORY_TINTS: Record<string, { bg: string; color: string }> = {
  social: { bg: '#EEEAF5', color: '#6D5AAE' },
  entertainment: { bg: '#FBE6E9', color: '#B54155' },
  games: { bg: '#E8EAFB', color: '#4F46E5' },
  news: { bg: '#EFEEEB', color: '#5B564F' },
  shopping: { bg: '#FBF3DE', color: '#A9863F' },
  dating: { bg: '#FBE6E9', color: '#B54155' },
};

export const MOCK_APPS: MockApp[] = [
  { id: 'instagram', name: 'Instagram', categoryId: 'social' },
  { id: 'tiktok', name: 'TikTok', categoryId: 'social' },
  { id: 'x', name: 'X', categoryId: 'social' },
  { id: 'facebook', name: 'Facebook', categoryId: 'social' },
  { id: 'reddit', name: 'Reddit', categoryId: 'social' },
  { id: 'snapchat', name: 'Snapchat', categoryId: 'social' },
  { id: 'youtube', name: 'YouTube', categoryId: 'entertainment' },
  { id: 'netflix', name: 'Netflix', categoryId: 'entertainment' },
  { id: 'twitch', name: 'Twitch', categoryId: 'entertainment' },
  { id: 'primevideo', name: 'Prime Video', categoryId: 'entertainment' },
  { id: 'roblox', name: 'Roblox', categoryId: 'games' },
  { id: 'clashroyale', name: 'Clash Royale', categoryId: 'games' },
  { id: 'candycrush', name: 'Candy Crush', categoryId: 'games' },
  { id: 'brawlstars', name: 'Brawl Stars', categoryId: 'games' },
  { id: 'googlenews', name: 'Google News', categoryId: 'news' },
  { id: 'bbc', name: 'BBC News', categoryId: 'news' },
  { id: 'cnn', name: 'CNN', categoryId: 'news' },
  { id: 'amazon', name: 'Amazon', categoryId: 'shopping' },
  { id: 'ebay', name: 'eBay', categoryId: 'shopping' },
  { id: 'temu', name: 'Temu', categoryId: 'shopping' },
  { id: 'tinder', name: 'Tinder', categoryId: 'dating' },
  { id: 'bumble', name: 'Bumble', categoryId: 'dating' },
  { id: 'hinge', name: 'Hinge', categoryId: 'dating' },
];

export function appsInCategory(categoryId: string): MockApp[] {
  return MOCK_APPS.filter(app => app.categoryId === categoryId);
}

