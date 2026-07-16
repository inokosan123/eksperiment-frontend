import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const ARROW_STRIKE_SOUND = require('@/assets/audio/arrow-strike.wav');

let strikePlayer: AudioPlayer | null = null;
let strikeInitPromise: Promise<void> | null = null;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureStrikePlayer() {
  if (Platform.OS === 'web') return;
  if (strikePlayer?.isLoaded) return;

  if (!strikeInitPromise) {
    strikeInitPromise = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      });

      strikePlayer = createAudioPlayer(ARROW_STRIKE_SOUND, {
        updateInterval: 1000,
        keepAudioSessionActive: true,
      });
      strikePlayer.volume = 0.74;
    })().catch(() => {
      strikeInitPromise = null;
    });
  }

  await strikeInitPromise;
}

export function preloadArrowStrikeSound() {
  void ensureStrikePlayer();
}

export async function playArrowStrikeFeedback() {
  if (Platform.OS === 'web') return;

  void ensureStrikePlayer().then(async () => {
    const player = strikePlayer;
    if (!player) return;

    try {
      if (player.playing) {
        player.pause();
      }
      player.volume = 0.74;
      await player.seekTo(0);
      player.play();
    } catch {}
  });

  // Heavy hit as the arrow lands, then a success confirm as the reward.
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await wait(60);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}
