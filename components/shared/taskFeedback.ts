import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const TASK_CHECK_SOUND = require('@/assets/audio/task-check.wav');

let checkPlayer: AudioPlayer | null = null;
let audioInitPromise: Promise<void> | null = null;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureCheckPlayer() {
  if (Platform.OS === 'web') return;
  if (checkPlayer?.isLoaded) return;

  if (!audioInitPromise) {
    audioInitPromise = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      });

      checkPlayer = createAudioPlayer(TASK_CHECK_SOUND, {
        updateInterval: 1000,
        keepAudioSessionActive: true,
      });
      checkPlayer.volume = 0.9;
    })().catch(() => {
      audioInitPromise = null;
    });
  }

  await audioInitPromise;
}

export function preloadTaskFeedbackSound() {
  void ensureCheckPlayer();
}

function playTaskCheckSound() {
  if (Platform.OS === 'web') return;

  void ensureCheckPlayer().then(async () => {
    const player = checkPlayer;
    if (!player) return;

    try {
      if (player.playing) {
        player.pause();
      }
      player.volume = 0.9;
      await player.seekTo(0);
      player.play();
    } catch {}
  });
}

export async function playTaskCompleteFeedback() {
  if (Platform.OS === 'web') return;
  playTaskCheckSound();

  // Layered cascade matched to the ~1s celebratory burst:
  //   • Heavy thump on tap → satisfying "landed it" feel.
  //   • Success notification at ~50ms → confirms completion.
  //   • Soft Light tap at ~140ms → tail flourish in time with the
  //     particle bloom, so the haptic feels celebratory not just clipped.
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await wait(50);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await wait(90);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export function playTaskUndoFeedback() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}
