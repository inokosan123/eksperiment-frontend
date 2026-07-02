import FocusPlaceholderView from '@/components/focus-watch/FocusPlaceholderView';
import { STRICT_WATCH_PLACEHOLDER } from '@/components/focus-watch/focusContent';

export default function StrictWatchScreen() {
  return <FocusPlaceholderView config={STRICT_WATCH_PLACEHOLDER} />;
}
