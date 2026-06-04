export type GuidedChapter = 'protect' | 'build' | 'rise' | 'tools' | 'conclusion';

export type GuidedStep =
  | 'buildBigEvents'
  | 'buildMonthlyGoals'
  | 'buildHabits'
  | 'buildChallenges'
  | 'buildMyRoutine'
  | 'homeClimax'
  | 'riseBibleHighlight'
  | 'risePrayerBook'
  | 'toolsJournal'
  | 'toolsNotes'
  | 'toolsGratitude'
  | 'toolsReadingList'
  | 'toolsBucketList'
  | 'toolsPomodoro'
  | 'privacy'
  | 'recap'
  | 'promoCode'
  | 'paywall';

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

export type GuidedOverlayPlacement = 'above' | 'below' | 'center';

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
};
