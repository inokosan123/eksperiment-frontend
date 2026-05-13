import type { ChallengeRecord } from '@/components/challenges/challengeData';
import { BIBLE_BOOKS, getBibleBook, PSALMS_ID } from '@/constants/scripture';

export type ScriptureChallengeUnit = {
  index: number;
  bookId: number;
  bookName: string;
  chapter: number;
  ref: string;
  noun: 'chapter' | 'psalm';
};

type ChallengePlanKey = Pick<ChallengeRecord, 'templateId' | 'groupKey' | 'totalUnits' | 'progressTotal'>;

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function expandBooks(bookIds: number[], chapterCaps: Record<number, number> = {}) {
  const units: Omit<ScriptureChallengeUnit, 'index'>[] = [];

  for (const bookId of bookIds) {
    const book = getBibleBook(bookId);
    if (!book) continue;
    const chapterCount = Math.min(book.chapters, chapterCaps[bookId] ?? book.chapters);
    for (let chapter = 1; chapter <= chapterCount; chapter += 1) {
      units.push({
        bookId,
        bookName: book.name,
        chapter,
        ref: bookId === PSALMS_ID ? `Psalm ${chapter}` : `${book.name} ${chapter}`,
        noun: bookId === PSALMS_ID ? 'psalm' : 'chapter',
      });
    }
  }

  return units.map((unit, index) => ({ ...unit, index }));
}

export function getScriptureChallengeUnits(challenge: ChallengePlanKey): ScriptureChallengeUnit[] {
  switch (challenge.templateId) {
    case 'nt_full':
      return expandBooks(range(40, 66));
    case 'gospel_four':
      return expandBooks(range(40, 43));
    case 'gospel_matthew':
      return expandBooks([40]);
    case 'gospel_mark':
      return expandBooks([41]);
    case 'gospel_luke':
      return expandBooks([42]);
    case 'gospel_john':
      return expandBooks([43]);
    case 'nt_acts':
      return expandBooks([44]);
    case 'nt_paul_epistles':
      return expandBooks(range(45, 58));
    case 'nt_catholic_epistles':
      return expandBooks(range(59, 65));
    case 'nt_revelation':
      return expandBooks([66]);
    case 'psalter_full':
      return expandBooks([PSALMS_ID]);
    case 'ot_full':
      // The catalog total for the full OT follows the 929 chapter plan:
      // Psalm 151 and Daniel 13-14 stay available elsewhere, but are not in this challenge.
      return expandBooks(range(1, 39), { [PSALMS_ID]: 150, 27: 12 });
    case 'ot_pentateuch':
      return expandBooks(range(1, 5));
    case 'ot_history':
      return expandBooks(range(6, 17));
    case 'ot_wisdom':
      return expandBooks([18, 20, 21, 22]);
    case 'ot_prophets':
      return expandBooks(range(23, 39));
    default:
      if (challenge.groupKey === 'psalter') return expandBooks([PSALMS_ID]);
      if (challenge.groupKey === 'new_testament') return expandBooks(range(40, 66));
      if (challenge.groupKey === 'old_testament') return expandBooks(range(1, 39), { [PSALMS_ID]: 150, 27: 12 });
      return [];
  }
}

export function getScriptureChallengeTotal(challenge: ChallengePlanKey) {
  const plannedTotal = getScriptureChallengeUnits(challenge).length;
  return plannedTotal || challenge.totalUnits || challenge.progressTotal || 0;
}

export function getScriptureChallengeProgressUnit(challenge: ChallengePlanKey) {
  return challenge.groupKey === 'psalter' ? 'psalms' : 'chapters';
}

export function getScriptureChallengeUnitLabel(challenge: ChallengePlanKey, count: number) {
  const isPsalter = challenge.groupKey === 'psalter';
  if (isPsalter) return count === 1 ? 'psalm' : 'psalms';
  return count === 1 ? 'chapter' : 'chapters';
}

export function getScriptureChallengeReadingType(challenge: ChallengePlanKey) {
  if (challenge.groupKey === 'psalter') return 'psalm';
  return 'chapter';
}

export function getBookName(bookId: number) {
  return getBibleBook(bookId)?.name ?? BIBLE_BOOKS.find(book => book.id === bookId)?.name ?? `Book ${bookId}`;
}
