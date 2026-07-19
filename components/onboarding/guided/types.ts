export type GuidedChapter =
  | 'protect'
  | 'build'
  | 'organize'
  | 'grow'
  | 'rise'
  | 'tools'
  | 'homeReveal'
  | 'firstCheckoff'
  | 'privacy'
  | 'paywall'
  | 'postPaywall'
  | 'profile'
  | 'account'
  | 'conclusion';

export type GuidedStep =
  | 'buildBigEvents'
  | 'buildMonthlyGoals'
  | 'buildHabits'
  | 'buildChallenges'
  | 'buildMyRoutine'
  | 'homeClimax'
  | 'focusScreenTime'
  | 'focusWebProtection'
  | 'focusOverview'
  | 'riseBibleHighlight'
  | 'risePrayerBook'
  | 'toolsJournal'
  | 'toolsNotes'
  | 'toolsGratitude'
  | 'toolsReadingList'
  | 'toolsBucketList'
  | 'toolsPomodoro'
  | 'homeReveal'
  | 'firstCheckoff'
  | 'privacy'
  | 'recap'
  | 'promoCode'
  | 'paywall'
  | 'postPaywallBrand'
  | 'postPaywallProfile'
  | 'accountCreation';

export type GuidedPhase = string;

export type GuidedTargetId = string;

export type GuidedEvent = {
  type: 'opened' | 'saved' | 'updated' | 'completed' | 'skipped' | 'custom';
  step: GuidedStep;
  phase?: GuidedPhase;
  entityKey?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
};

export type GuidedSessionState = {
  version: 1;
  active: boolean;
  currentChapter: GuidedChapter;
  chapterOrder: GuidedChapter[];
  activeStep: GuidedStep;
  phase: GuidedPhase;
  route: string;
  completedSteps: GuidedStep[];
  createdIds: Record<string, string>;
  updatedAt: number;
};

export type GuidedTargetLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GuidedOverlayPlacement = 'above' | 'below' | 'center' | 'bottom';

// Animated gesture demonstration rendered over the spotlight target.
export type GuidedGestureHint = 'tap' | 'long-press' | 'swipe-left' | 'swipe-right';

export type GuidedOverlayProgress = {
  current: number;
  total: number;
};

export type GuidedOverlayPresentation = {
  key: string;
  message: string;
  targetId?: GuidedTargetId;
  cutoutPadding?: number;
  placement?: GuidedOverlayPlacement;
  allowTargetInteraction?: boolean;
  celebrate?: boolean;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  // A whisper scrim instead of the full dim — used for "look at the whole
  // screen" reveal moments where nothing is spotlit.
  lightScrim?: boolean;
  // Structured coach-bubble content. All optional — presentations that only
  // pass `message` render exactly as before.
  eyebrow?: string;
  highlights?: string[];
  chips?: string[];
  action?: string;
  hint?: GuidedGestureHint;
  // Where the hint sits inside the cutout — e.g. 'left' over a task's check circle.
  hintAnchor?: 'center' | 'left' | 'right';
  // Fine offset from the anchored position, e.g. to sit on the SECOND day tab.
  hintOffset?: { x?: number; y?: number };
  progress?: GuidedOverlayProgress;
};
