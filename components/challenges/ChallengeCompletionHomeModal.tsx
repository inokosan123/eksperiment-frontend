import React, { useEffect } from 'react';
import { Modal } from 'react-native';
import CelebrationOverlayBase from '@/components/bucket/CelebrationOverlayBase';
import { playChallengeCompleteFeedback } from '@/components/challenges/challengeFeedback';

type Props = {
  visible: boolean;
  title: string;
  variant?: 'challenge' | 'churchWeek';
  trophyCount?: number;
  currentStreak?: number;
  onExited: () => void;
};

/**
 * The moment a challenge is finished.
 *
 * This used to be its own modal: a gradient stage with the trophy Lottie in a
 * bordered box, a tracked-sans CONGRATULATIONS kicker over a serif title, and
 * a gold CONTINUE button that switched its own label to "SAVING..." and then
 * held the card on screen for a further second while timers unwound. Three
 * different things were animating the same dismissal, and the reward ended
 * with a wait.
 *
 * It is the bucket list's celebration now — the one the app already keeps for
 * an achieved dream, and which Focus milestones and the journal streak also
 * borrow. Veil, rings, confetti, the trophy arriving on its own Lottie, and
 * copy set entirely in the serif. There is no button and no timer: the whole
 * screen is the dismiss target, and the trophy plays its exit as you leave.
 * A reward should end when you are done looking at it.
 */
export default function ChallengeCompletionHomeModal({
  visible,
  title,
  variant = 'challenge',
  trophyCount = 0,
  currentStreak = 0,
  onExited,
}: Props) {
  useEffect(() => {
    if (!visible) return;
    void playChallengeCompleteFeedback();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      presentationStyle="overFullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onExited}
    >
      <CelebrationOverlayBase
        onClose={onExited}
        title={variant === 'churchWeek' ? 'Weekly trophy earned' : 'Challenge complete'}
        subtitleStrong={`${title}.`}
        subtitle={variant === 'churchWeek'
          ? `Every planned Church visit is complete. Trophy ${trophyCount} is now in your achievements${currentStreak > 1 ? ` with a ${currentStreak}-week streak` : ''}.`
          : 'A new trophy joins your collection.'}
      />
    </Modal>
  );
}
