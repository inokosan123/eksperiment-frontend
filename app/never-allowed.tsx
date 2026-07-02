import FocusPlaceholderView from '@/components/focus-watch/FocusPlaceholderView';
import { NEVER_ALLOWED_PLACEHOLDER } from '@/components/focus-watch/focusContent';

export default function NeverAllowedScreen() {
  return <FocusPlaceholderView config={NEVER_ALLOWED_PLACEHOLDER} />;
}
