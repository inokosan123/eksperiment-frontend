import * as StoreReview from 'expo-store-review';

export async function requestOnboardingReviewIfAvailable() {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
