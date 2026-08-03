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
  sites: string[];
  sitesNote: string;
};

export const WEB_PACKS: WebPackContent[] = [
  {
    id: 'gambling',
    name: 'Gambling & Betting',
    detail: 'Betting sites, casinos, lotteries',
    emoji: 'joker',
    sites: [...WEB_PACK_DOMAINS.gambling],
    sitesNote: 'This pack also includes a curated list we will keep growing.',
  },
  {
    id: 'adult',
    name: 'Adult Content',
    detail: "Apple's system filter plus our curated list",
    emoji: 'eye',
    slashed: true,
    sites: [...WEB_PACK_DOMAINS.adult],
    sitesNote: "Apple's automatic adult-content filter strengthens coverage beyond this list.",
  },
  {
    id: 'social',
    name: 'Social Web',
    detail: 'Feeds in the browser — X, Reddit, Facebook',
    emoji: 'mobile-phone',
    sites: [...WEB_PACK_DOMAINS.social],
    sitesNote: 'Social media apps themselves are managed separately through Screen Time.',
  },
  {
    id: 'news',
    name: 'News & Doomscroll',
    detail: 'Endless headlines and comment wars',
    emoji: 'newspaper',
    sites: [...WEB_PACK_DOMAINS.news],
    sitesNote: 'This pack also includes a curated list we will keep growing.',
  },
];

// Readable preview catalog for web/Expo Go. A native build never treats these
// labels as Apple selections; Family Controls app tokens remain private.
export type PreviewApp = { id: string; name: string; categoryId: string };

/**
 * WHAT A RULE IS — the colour a group's card, seal and sheet are struck in.
 *
 * ⚠️ Colour on a rule carries its STATE, never which group it is. Rose means
 * shut, everywhere in Focus and nowhere else; a group merely holding a limit
 * takes the one measured colour below. That separation is the whole point:
 * when a group's own tint could be red, a card with a LIMIT looked exactly like
 * a card that was BLOCKED, and no amount of copy fixes a colour that lies.
 *
 * A group is told apart by its name and its face, not by its hue.
 */
export const RULE_TONES = {
  limit: { color: '#6D5AAE', bg: '#EEEAF5' },
  blocked: { color: '#A24351', bg: '#F8E7EA' },
} as const;

/**
 * WHICH GROUP IT IS — used only where several groups are shown at once and have
 * to be told apart at a glance: the capacity rail's segments.
 *
 * ⚠️ Two rules for anything added here. It may not sit near rose (351°), which
 * belongs to Blocked; and it may not be a dead neutral — News was a true grey
 * and read as a disabled row rather than a category. The hues below are spread
 * around the wheel (40 · 150 · 195 · 225 · 254 · 318) so no two segments blur
 * into one another on a 12pt bar.
 */
export const CATEGORY_TINTS: Record<string, { bg: string; color: string }> = {
  'always-blocked': { bg: '#F8E7EA', color: '#A24351' },
  social: { bg: '#EEEAF5', color: '#6D5AAE' },
  entertainment: { bg: '#E3F0F2', color: '#2C7C8C' },
  games: { bg: '#E4F0EA', color: '#2E7D62' },
  news: { bg: '#E8EDF5', color: '#4A6699' },
  shopping: { bg: '#FBF3DE', color: '#A9863F' },
  dating: { bg: '#F5E8F3', color: '#8E4A85' },
};

/**
 * The rail colour for ANY group, including one you made yourself.
 *
 * The six tints above cover the built-in categories. Everything else used to
 * fall back to one gold — so two custom groups were the same colour as each
 * other AND as the rail's own buffer shading, which is exactly where a stacked
 * bar stops being readable.
 *
 * WHY ONLY THREE. The wheel is already spoken for: 40 · 159 · 190 · 219 · 254 ·
 * 308, plus rose at 351 for Blocked. Measured rather than eyeballed, the only
 * genuinely free stretch is 40→159, and three hues is what fits there with the
 * same separation the built-ins keep between themselves (~26–31°). A first
 * attempt at five put one 15° from Games and another 16° from Social, which
 * looked like a bigger palette and read as a smaller one.
 *
 * The colour is drawn from the group's id, not its position, so a group keeps
 * the same colour when the plan is reordered or another group is removed.
 *
 * Past three custom groups colours must repeat. That is what the legend under
 * the rail is for: colour carries the fast reading, the legend the exact one.
 */
const GROUP_RAIL_EXTENSION = ['#7D7A1C', '#478A2E', '#2E7A3F'];

export function groupRailColor(groupId: string): string {
  const tint = CATEGORY_TINTS[groupId];
  if (tint) return tint.color;
  let hash = 0;
  for (let index = 0; index < groupId.length; index += 1) {
    hash = (hash * 31 + groupId.charCodeAt(index)) >>> 0;
  }
  return GROUP_RAIL_EXTENSION[hash % GROUP_RAIL_EXTENSION.length];
}

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

