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
  packs: {
    id: keyof typeof WEB_PACK_DOMAINS;
    mode: 'off' | 'on' | 'never';
    extraDomains?: string[];
  }[];
  customPacks: { id?: string; mode: 'off' | 'on' | 'never'; domains: string[] }[];
  customDomains: { domain: string }[];
  neverAllowed?: {
    id: string;
    targetLabel: string;
    targetKind: 'builtin-pack' | 'custom-pack' | 'domain';
    targetId: string;
    domainsSnapshot: string[];
  }[];
};

export type NeverDomainContext = {
  domain: string;
  commitmentId: string;
  label: string;
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

  const neverDomainContexts: NeverDomainContext[] = [];
  const neverSeen = new Set<string>();
  const sealedBuiltInTargets = new Set<string>();
  const sealedCustomTargets = new Set<string>();
  const neverAllowed = Array.isArray(input.neverAllowed) ? input.neverAllowed : [];
  for (const commitment of neverAllowed) {
    if (commitment.targetKind === 'builtin-pack') sealedBuiltInTargets.add(commitment.targetId);
    if (commitment.targetKind === 'custom-pack') sealedCustomTargets.add(commitment.targetId);
    for (const raw of commitment.domainsSnapshot) {
      const domain = normalizeWebDomain(raw);
      if (!domain.includes('.') || neverSeen.has(domain)) continue;
      neverSeen.add(domain);
      neverDomainContexts.push({
        domain,
        commitmentId: commitment.id,
        label: commitment.targetLabel,
      });
      add(domain);
    }
  }

  // Permanent promises are inserted first. A person's explicit choices must
  // never be displaced by a broad starter pack when Apple's explicit-domain
  // limit is reached.
  input.customDomains.forEach(entry => add(entry.domain));
  input.packs
    .filter(pack => pack.mode !== 'off' && !sealedBuiltInTargets.has(pack.id))
    .forEach(pack => pack.extraDomains?.forEach(add));
  input.customPacks
    .filter((pack, index) => {
      if (pack.mode === 'off') return false;
      const id = pack.id;
      return !id || !sealedCustomTargets.has(id);
    })
    .forEach(pack => pack.domains.forEach(add));

  for (const id of Object.keys(WEB_PACK_DOMAINS) as (keyof typeof WEB_PACK_DOMAINS)[]) {
    if (sealedBuiltInTargets.has(id)) continue;
    if (!input.packs.some(pack => pack.id === id && pack.mode !== 'off')) continue;
    WEB_PACK_DOMAINS[id].forEach(add);
  }

  return {
    domains: ordered.slice(0, WEB_DOMAIN_LIMIT),
    omittedDomains: ordered.slice(WEB_DOMAIN_LIMIT),
    requestedCount: ordered.length,
    neverDomains: Array.from(neverSeen),
    neverDomainContexts,
    neverCapacityAvailable: Math.max(0, WEB_DOMAIN_LIMIT - neverSeen.size),
    adultFilterActive: input.packs.some(pack => pack.id === 'adult' && pack.mode !== 'off')
      || neverAllowed.some(commitment => commitment.targetKind === 'builtin-pack' && commitment.targetId === 'adult'),
    adultFilterNeverCommitmentId: neverAllowed.find(
      commitment => commitment.targetKind === 'builtin-pack' && commitment.targetId === 'adult'
    )?.id ?? null,
  };
}
