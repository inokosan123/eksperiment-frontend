import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const PRAYER_COMPLETE_SOUND = require('@/assets/audio/prayer-complete.wav');

let completePlayer: AudioPlayer | null = null;
let audioInitPromise: Promise<void> | null = null;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureCompletePlayer() {
  if (Platform.OS === 'web') return;
  if (completePlayer?.isLoaded) return;

  if (!audioInitPromise) {
    audioInitPromise = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      });

      completePlayer = createAudioPlayer(PRAYER_COMPLETE_SOUND, {
        updateInterval: 1000,
        keepAudioSessionActive: true,
      });
      completePlayer.volume = 0.78;
    })().catch(() => {
      audioInitPromise = null;
    });
  }

  await audioInitPromise;
}

export function preloadPrayerCompleteSound() {
  void ensureCompletePlayer();
}

function playPrayerCompleteSound() {
  if (Platform.OS === 'web') return;

  void ensureCompletePlayer().then(async () => {
    const player = completePlayer;
    if (!player) return;

    try {
      if (player.playing) player.pause();
      player.volume = 0.78;
      await player.seekTo(0);
      player.play();
    } catch {}
  });
}

export async function playPrayerCompleteFeedback() {
  if (Platform.OS === 'web') return;
  playPrayerCompleteSound();

  // Contemplative completion cascade:
  //   • Heavy chime tap → grounding moment as the bell rings.
  //   • Success notification at ~140ms → confirms the rule is fulfilled.
  //   • Soft Light tap at ~280ms → exhale, settles the celebration.
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await wait(140);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await wait(140);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}
