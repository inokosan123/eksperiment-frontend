import type { WebPackId } from './dayPlanStore';
import { WEB_PACK_DOMAINS } from './webProtectionCatalog';

// Custom packs all share one emblem so the built-in packs keep their identity.
export const CUSTOM_PACK_EMOJI = 'warning';

export type WebPackContent = {
  id: WebPackId;
  name: string;
  detail: string;
  emoji: string;          // Noto emoji name from the shared catalog
  slashed?: boolean;      // draw a red "not allowed" line across the emoji
  iconBg: string;
  sites: string[];
  sitesNote: string;
};

export const WEB_PACKS: WebPackContent[] = [
  {
    id: 'gambling',
    name: 'Gambling & Betting',
    detail: 'Betting sites, casinos, lotteries',
    emoji: 'joker',
    iconBg: '#FBE6E9',
    sites: [...WEB_PACK_DOMAINS.gambling],
    sitesNote: '…and a curated list we keep growing',
  },
  {
    id: 'adult',
    name: 'Adult Content',
    detail: "Apple's system filter plus our curated list",
    emoji: 'eye',
    slashed: true,
    iconBg: '#FBE6E9',
    sites: [...WEB_PACK_DOMAINS.adult],
    sitesNote: "…plus Apple's automatic adult filter for the rest",
  },
  {
    id: 'social',
    name: 'Social Web',
    detail: 'Feeds in the browser — X, Reddit, Facebook',
    emoji: 'mobile-phone',
    iconBg: '#E1F1EC',
    sites: [...WEB_PACK_DOMAINS.social],
    sitesNote: '…the apps themselves live in Screen Time',
  },
  {
    id: 'news',
    name: 'News & Doomscroll',
    detail: 'Endless headlines and comment wars',
    emoji: 'newspaper',
    iconBg: '#FBF3DE',
    sites: [...WEB_PACK_DOMAINS.news],
    sitesNote: '…and a curated list we keep growing',
  },
];

// Readable preview catalog for web/Expo Go. A native build never treats these
// labels as Apple selections; Family Controls app tokens remain private.
export type PreviewApp = { id: string; name: string; categoryId: string };

export const CATEGORY_TINTS: Record<string, { bg: string; color: string }> = {
  social: { bg: '#EEEAF5', color: '#6D5AAE' },
  entertainment: { bg: '#FBE6E9', color: '#B54155' },
  games: { bg: '#E8EAFB', color: '#4F46E5' },
  news: { bg: '#EFEEEB', color: '#5B564F' },
  shopping: { bg: '#FBF3DE', color: '#A9863F' },
  dating: { bg: '#FBE6E9', color: '#B54155' },
};

export const PREVIEW_APPS: PreviewApp[] = [
  { id: 'whatsapp', name: 'WhatsApp', categoryId: 'social' },
  { id: 'viber', name: 'Viber', categoryId: 'social' },
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
  { id: 'pubg', name: 'PUBG Mobile', categoryId: 'games' },
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

export type EssentialAppOption = {
  id: string;
  name: string;
  group: 'Communication' | 'Planning' | 'Navigation' | 'Health & Safety' | 'System' | 'Other apps';
  core?: boolean;
};

export const ESSENTIAL_APP_OPTIONS: EssentialAppOption[] = [
  { id: 'phone', name: 'Phone', group: 'Communication', core: true },
  { id: 'messages', name: 'Messages', group: 'Communication', core: true },
  { id: 'facetime', name: 'FaceTime', group: 'Communication', core: true },
  { id: 'maps', name: 'Maps', group: 'Navigation', core: true },
  { id: 'camera', name: 'Camera', group: 'System' },
  { id: 'wallet', name: 'Wallet', group: 'Health & Safety' },
  { id: 'mail', name: 'Mail', group: 'Communication' },
  { id: 'gmail', name: 'Gmail', group: 'Communication' },
  { id: 'calendar', name: 'Calendar', group: 'Planning' },
  { id: 'reminders', name: 'Reminders', group: 'Planning' },
  { id: 'clock', name: 'Clock', group: 'Planning' },
  { id: 'googlemaps', name: 'Google Maps', group: 'Navigation' },
  { id: 'health', name: 'Health', group: 'Health & Safety' },
  { id: 'findmy', name: 'Find My', group: 'Health & Safety' },
  { id: 'settings', name: 'Settings', group: 'System' },
  { id: 'safari', name: 'Safari', group: 'System' },
  { id: 'chrome', name: 'Chrome', group: 'System' },
  ...PREVIEW_APPS.map(app => ({
    id: app.id,
    name: app.name,
    group: 'Other apps' as const,
  })),
];

export function appsInCategory(categoryId: string): PreviewApp[] {
  return PREVIEW_APPS.filter(app => app.categoryId === categoryId);
}

