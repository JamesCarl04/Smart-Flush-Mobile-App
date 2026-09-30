import { Audio } from 'expo-av';

let lastPlayTimestamp = 0;
const PLAY_COOLDOWN_MS = 500;

export function _resetSoundCooldownForTests(): void {
  lastPlayTimestamp = 0;
}

/**
 * Plays the Facebook-style task completion chime.
 * Non-blocking and fire-and-forget; never throws or blocks execution.
 * Throttled to avoid rapid duplicate plays if invoked concurrently.
 */
export async function playCompletionSound(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayTimestamp < PLAY_COOLDOWN_MS) {
    return;
  }
  lastPlayTimestamp = now;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/task-complete.wav'),
      { shouldPlay: true },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    lastPlayTimestamp = 0;
    // Fire-and-forget, non-blocking: silent mode or device audio errors will not fail task completion
  }
}

