import { Modal } from 'react-native';
import CelebrationOverlayBase from '@/components/bucket/CelebrationOverlayBase';

const MILESTONE_TITLES: Record<number, string> = {
  7: 'Seven days kept!',
  30: 'Thirty days kept!',
  100: 'A hundred days kept!',
};

// The loud moment we save for 7 / 30 / 100 — the same trophy celebration the
// bucket list earned its wings with: veil, rings, confetti, the trophy Lottie.
// Everyday trophies land silently in the calendar; this is the feast day.
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
      />
    </Modal>
  );
}
