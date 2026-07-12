export const WEB_DOMAIN_LIMIT = 50;

export const WEB_PACK_DOMAINS = {
  gambling: [
    'bet365.com',
    'stake.com',
    '1xbet.com',
    'williamhill.com',
    'betway.com',
    'pokerstars.com',
    'betfair.com',
    'unibet.com',
    'bwin.com',
    'draftkings.com',
    'fanduel.com',
    'betmgm.com',
    'caesars.com',
    'paddypower.com',
    'ladbrokes.com',
    'coral.co.uk',
    '888sport.com',
    '888casino.com',
    'betfred.com',
    'betvictor.com',
    'leovegas.com',
    'betsson.com',
    'mozzartbet.com',
    'meridianbet.com',
    'maxbet.rs',
    'soccerbet.rs',
  ],
  adult: ['pornhub.com', 'xvideos.com', 'onlyfans.com', 'xnxx.com', 'chaturbate.com'],
  social: [
    'x.com',
    'facebook.com',
    'reddit.com',
    'instagram.com',
    'tiktok.com',
    'threads.net',
    'snapchat.com',
    'pinterest.com',
  ],
  news: [
    'news.google.com',
    'cnn.com',
    'bbc.com',
    'dailymail.co.uk',
    'nypost.com',
    'foxnews.com',
    'newsweek.com',
    'buzzfeednews.com',
  ],
} as const;

type WebProtectionInput = {
  packs: { id: keyof typeof WEB_PACK_DOMAINS; mode: 'off' | 'on' | 'never' }[];
  customPacks: { mode: 'off' | 'on' | 'never'; domains: string[] }[];
  customDomains: { domain: string }[];
};

export function normalizeWebDomain(raw: string) {
  const domain = raw
    .trim()
    .toLocaleLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');
  if (!domain || domain.length > 253 || domain.includes('..')) return '';
  const labels = domain.split('.');
  if (labels.length < 2) return '';
  const validLabel = (label: string) =>
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label);
  return labels.every(validLabel) ? domain : '';
}

export function resolveWebProtectionDomains(input: WebProtectionInput) {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const domain = normalizeWebDomain(raw);
    if (!domain.includes('.') || seen.has(domain)) return;
    seen.add(domain);
    ordered.push(domain);
  };

  // A person's explicit choices must never be displaced by a broad starter pack.
  input.customDomains.forEach(entry => add(entry.domain));
  input.customPacks
    .filter(pack => pack.mode !== 'off')
    .forEach(pack => pack.domains.forEach(add));

  for (const id of Object.keys(WEB_PACK_DOMAINS) as (keyof typeof WEB_PACK_DOMAINS)[]) {
    if (!input.packs.some(pack => pack.id === id && pack.mode !== 'off')) continue;
    WEB_PACK_DOMAINS[id].forEach(add);
  }

  return {
    domains: ordered.slice(0, WEB_DOMAIN_LIMIT),
    omittedDomains: ordered.slice(WEB_DOMAIN_LIMIT),
    requestedCount: ordered.length,
    adultFilterActive: input.packs.some(pack => pack.id === 'adult' && pack.mode !== 'off'),
  };
}
