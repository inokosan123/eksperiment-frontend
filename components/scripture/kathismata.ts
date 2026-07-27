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

export const KATHISMATA: { numeral: string; from: number; to: number }[] = [
  { numeral: 'I', from: 1, to: 8 },
  { numeral: 'II', from: 9, to: 16 },
  { numeral: 'III', from: 17, to: 23 },
  { numeral: 'IV', from: 24, to: 31 },
  { numeral: 'V', from: 32, to: 36 },
  { numeral: 'VI', from: 37, to: 45 },
  { numeral: 'VII', from: 46, to: 54 },
  { numeral: 'VIII', from: 55, to: 63 },
  { numeral: 'IX', from: 64, to: 69 },
  { numeral: 'X', from: 70, to: 76 },
  { numeral: 'XI', from: 77, to: 84 },
  { numeral: 'XII', from: 85, to: 90 },
  { numeral: 'XIII', from: 91, to: 100 },
  { numeral: 'XIV', from: 101, to: 104 },
  { numeral: 'XV', from: 105, to: 108 },
  { numeral: 'XVI', from: 109, to: 117 },
  { numeral: 'XVII', from: 118, to: 118 },
  { numeral: 'XVIII', from: 119, to: 133 },
  { numeral: 'XIX', from: 134, to: 142 },
  { numeral: 'XX', from: 143, to: 150 },
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
      key: kathisma.numeral,
      label: `KATHISMA ${kathisma.numeral} · ${kathisma.from === kathisma.to
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
