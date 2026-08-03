import { Modal } from 'react-native';
import LottieView from 'lottie-react-native';
import CelebrationOverlayBase from '@/components/bucket/CelebrationOverlayBase';
import { FOCUS_MEDALLION_SOURCE } from '@/components/focus-watch/FocusMedallion';

const MILESTONE_TITLES: Record<number, string> = {
  7: 'Seven days kept!',
  30: 'Thirty days kept!',
  100: 'A hundred days kept!',
};

// The loud moment we save for 7 / 30 / 100 — the bucket list's celebration:
// veil, rings, confetti. Everyday medallions land silently in the calendar;
// this is the feast day.
//
// The emblem is focus's own medallion, not the challenge trophy. One player,
// one shot, no loop — the burst around it is Reanimated and the confetti is
// SVG, so this screen mounts exactly one Lottie no matter how loud it looks.
export default function MilestoneCongratsOverlay({
  milestone,
  onClose,
}: {
  milestone: number | null;
  onClose: () => void;
}) {
  if (milestone === null) return null;
  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <CelebrationOverlayBase
        onClose={onClose}
        title={MILESTONE_TITLES[milestone] ?? `${milestone} days kept!`}
        subtitleStrong={`${milestone} days of keeping your Daily Target.`}
        subtitle={'"Well done, thou good and faithful servant." — Matthew 25:21'}
        visual={(
          <LottieView
            source={FOCUS_MEDALLION_SOURCE}
            autoPlay
            loop={false}
            speed={1}
            style={{ width: 96, height: 96 }}
            resizeMode="contain"
            renderMode="HARDWARE"
          />
        )}
      />
    </Modal>
  );
}
