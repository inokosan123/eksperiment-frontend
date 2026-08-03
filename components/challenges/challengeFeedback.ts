import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

// A trophy is a larger, rarer reward than an ordinary task or prayer. Use the
// longer achievement chime so every Challenge variant has the same deliberate
// ceremonial finish.
const CHALLENGE_COMPLETE_SOUND = require('@/assets/audio/achievement-complete.wav');

let completePlayer: AudioPlayer | null = null;
let audioInitPromise: Promise<void> | null = null;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureChallengeCompletePlayer() {
  if (Platform.OS === 'web') return;
  if (completePlayer?.isLoaded) return;

  if (!audioInitPromise) {
    audioInitPromise = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      });

      completePlayer = createAudioPlayer(CHALLENGE_COMPLETE_SOUND, {
        updateInterval: 1000,
        keepAudioSessionActive: true,
      });
      completePlayer.volume = 0.8;
    })().catch(() => {
      audioInitPromise = null;
    });
  }

  await audioInitPromise;
}

export function preloadChallengeCompleteFeedback() {
  void ensureChallengeCompletePlayer();
}

function playChallengeCompleteSound() {
  if (Platform.OS === 'web') return;

  void ensureChallengeCompletePlayer().then(async () => {
    const player = completePlayer;
    if (!player) return;

    try {
      if (player.playing) player.pause();
      player.volume = 0.8;
      await player.seekTo(0);
      player.play();
    } catch {}
  });
}

export async function playChallengeCompleteFeedback() {
  if (Platform.OS === 'web') return;
  playChallengeCompleteSound();

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await wait(60);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await wait(125);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}
