import React from 'react';
import { StyleSheet, View } from 'react-native';
import CelebrationOverlayBase from '@/components/bucket/CelebrationOverlayBase';
import FocusLottie from '@/components/focus/FocusLottie';

export default function JournalStreakCelebration({
  currentStreak,
  onClose,
}: {
  currentStreak: number;
  onClose: () => void;
}) {
  const subtitle = currentStreak === 1
    ? 'Your journal streak has begun.'
    : 'Your journal streak is now ' + currentStreak + ' days.';

  return (
    <CelebrationOverlayBase
      onClose={onClose}
      title='Congratulations!'
      subtitleStrong='Today is in the book.'
      subtitle={subtitle}
      visual={(
        <View style={styles.bookStage}>
          <FocusLottie
            name='meru-book'
            loop
            autoplay
            speed={0.92}
            style={styles.bookAnimation}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bookStage: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookAnimation: {
    width: 128,
    height: 128,
  },
});
