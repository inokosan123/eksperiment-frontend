export type CompletionAttemptGuard = {
  tryStart: () => boolean;
  release: () => void;
  isLocked: () => boolean;
};

/** Small synchronous guard: two taps in the same JS turn can start one commit. */
export function createCompletionAttemptGuard(): CompletionAttemptGuard {
  let locked = false;
  return {
    tryStart() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    isLocked() {
      return locked;
    },
  };
}
