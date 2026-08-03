export type FocusAnalyticsRequestState<T> = {
  latestGeneration: number;
  committed: T | null;
};

export type FocusAnalyticsRequestAction<T> =
  | { type: 'started'; generation: number }
  | { type: 'resolved'; generation: number; value: T }
  | { type: 'invalidated'; generation: number };

export function reduceFocusAnalyticsRequest<T>(
  state: FocusAnalyticsRequestState<T>,
  action: FocusAnalyticsRequestAction<T>
): FocusAnalyticsRequestState<T> {
  if (action.type === 'started') {
    if (action.generation <= state.latestGeneration) return state;
    return {
      latestGeneration: action.generation,
      committed: state.committed,
    };
  }
  if (action.type === 'invalidated') {
    if (action.generation < state.latestGeneration) return state;
    return {
      latestGeneration: action.generation,
      committed: null,
    };
  }
  if (action.generation !== state.latestGeneration) return state;
  return {
    latestGeneration: state.latestGeneration,
    committed: action.value,
  };
}

export function focusAnalyticsRequestCanCommit(
  generation: number,
  latestGeneration: number,
  cancelled: boolean
) {
  return !cancelled && generation === latestGeneration;
}
