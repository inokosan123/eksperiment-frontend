// The Psalter is not a list of 151 numbers — it is twenty kathismata, the
// divisions it is actually read in. This app ships the Septuagint text (151
// psalms, twelve deuterocanonical books), so these are its own divisions.
//
// Psalm 151 belongs to no kathisma: its own superscription calls it outside
// the number, and it is set apart wherever the Psalter is listed.
//
// Shared, so Holy Scripture and Bible Notes divide the Psalter the same way.
// Verified: twenty groups, contiguous, every psalm 1–150 covered exactly
// once, none twice.
//
// Numbered in plain figures rather than Roman ones. The divisions are
// traditionally set I–XX, but a reader who has never met a kathisma should
// not also have to decode XVIII to find their place.

export const KATHISMATA: { number: number; from: number; to: number }[] = [
  { number: 1, from: 1, to: 8 },
  { number: 2, from: 9, to: 16 },
  { number: 3, from: 17, to: 23 },
  { number: 4, from: 24, to: 31 },
  { number: 5, from: 32, to: 36 },
  { number: 6, from: 37, to: 45 },
  { number: 7, from: 46, to: 54 },
  { number: 8, from: 55, to: 63 },
  { number: 9, from: 64, to: 69 },
  { number: 10, from: 70, to: 76 },
  { number: 11, from: 77, to: 84 },
  { number: 12, from: 85, to: 90 },
  { number: 13, from: 91, to: 100 },
  { number: 14, from: 101, to: 104 },
  { number: 15, from: 105, to: 108 },
  { number: 16, from: 109, to: 117 },
  { number: 17, from: 118, to: 118 },
  { number: 18, from: 119, to: 133 },
  { number: 19, from: 134, to: 142 },
  { number: 20, from: 143, to: 150 },
];

export const LAST_KATHISMA_PSALM = 150;

export type KathismaSection = {
  key: string;
  label: string;
  psalms: number[];
};

/**
 * Cuts a list of psalm numbers into its kathismata, dropping any division
 * nothing was left in — so a filtered Psalter keeps its divisions instead of
 * collapsing back into one run.
 */
export function groupPsalmsIntoKathismata(psalms: number[]): KathismaSection[] {
  const present = new Set(psalms);

  const sections = KATHISMATA
    .map(kathisma => ({
      key: `k${kathisma.number}`,
      label: `KATHISMA ${kathisma.number} · ${kathisma.from === kathisma.to
        ? `PSALM ${kathisma.from}`
        : `PSALMS ${kathisma.from}–${kathisma.to}`}`,
      psalms: Array.from(
        { length: kathisma.to - kathisma.from + 1 },
        (_, index) => kathisma.from + index,
      ).filter(number => present.has(number)),
    }))
    .filter(section => section.psalms.length > 0);

  const beyond = psalms.filter(number => number > LAST_KATHISMA_PSALM);
  if (beyond.length > 0) {
    sections.push({
      key: 'beyond',
      label: `OUTSIDE THE NUMBER · PSALM ${beyond[0]}`,
      psalms: beyond,
    });
  }
  return sections;
}
