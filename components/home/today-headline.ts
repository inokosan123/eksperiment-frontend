// What the Home progress card says about today.
//
// One voice across every state: the FACT first, then the short clause that
// says what it means. Two rules hold the ladder together.
//
// The line never repeats the percentage. It is already set in 66pt directly
// above, and a sentence that spends its words saying "43%" a second time
// says nothing. It spends them on the counts instead — how many are done,
// how many are left — which is the one thing the big number cannot tell you.
//
// The flame is named exactly once, at the top, where it is the reward. Every
// other rung is plain: what happened, and what it means. The card used to
// talk in fire at every level ("the flame is within reach", "keep feeding
// today's fire") while the number beside it spoke plainly, and the two did
// not sound like the same card.
//
// The ladder:
//
//   no tasks     nothing was scheduled — there is nothing to miss
//   set aside    every task skipped — the streak survives it
//   0%           tasks are waiting, none touched
//   1–39%        under way
//   40–69%       on pace
//   70–99%       almost closed, and what is left is small enough to name
//   100%         the day is complete — the one line that carries the flame

export type HomeDayMode = 'no-tasks' | 'all-skipped' | 'normal';

export type TodayHeadlineInput = {
  mode: HomeDayMode;
  /** 0–100, the same reading the medallion shows. */
  pct: number;
  /** Tasks completed today. */
  done: number;
  /** Tasks that counted today — scheduled minus the ones laid aside. */
  total: number;
  /** The run behind today; a skipped day does not break it. */
  streak: number;
};

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function todayHeadline({ mode, pct, done, total, streak }: TodayHeadlineInput): string {
  if (mode === 'no-tasks') return 'No tasks are scheduled today — nothing to miss.';

  if (mode === 'all-skipped') {
    // The claim has to match the card's own face: with no run behind today
    // there is no streak to hold, and saying so anyway would be a card
    // contradicting itself.
    return streak > 0
      ? 'Today’s tasks were skipped — your streak still holds.'
      : 'Today’s tasks were skipped — nothing was lost.';
  }

  // The counts have not arrived yet. Claim nothing that cannot be backed up.
  if (total <= 0) return 'Today is under way.';

  const left = Math.max(0, total - done);

  if (pct >= 100) {
    return total === 1
      ? 'Your one task is done — today’s flame is lit.'
      : `All ${total} done — today’s flame is lit.`;
  }
  if (pct >= 70) return `Almost there — ${count(left, 'task', 'tasks')} left.`;
  if (pct >= 40) return `${done} of ${total} done — you’re on pace.`;
  if (pct > 0) return `${done} of ${total} done — keep going.`;

  return total === 1
    ? 'One task waiting — start there.'
    : `${total} tasks waiting — start with one.`;
}
