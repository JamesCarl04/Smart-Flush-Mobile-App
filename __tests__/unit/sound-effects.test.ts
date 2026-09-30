import { Audio } from 'expo-av';

describe('playCompletionSound', () => {
  const {
    playCompletionSound,
    _resetSoundCooldownForTests,
  } = jest.requireActual('../../lib/sound-effects');

  beforeEach(() => {
    jest.clearAllMocks();
    _resetSoundCooldownForTests?.();
  });

  it('calls Audio.Sound.createAsync and plays sound', async () => {
    const mockUnload = jest.fn().mockResolvedValue(undefined);
    const mockSetUpdate = jest.fn();
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: {
        setOnPlaybackStatusUpdate: mockSetUpdate,
        unloadAsync: mockUnload,
      },
      status: { isLoaded: true },
    });

    await playCompletionSound();

    expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
      expect.anything(),
      { shouldPlay: true },
    );
    expect(mockSetUpdate).toHaveBeenCalled();
  });

  it('unloads sound when playback finishes', async () => {
    let statusCallback: any;
    const mockUnload = jest.fn().mockResolvedValue(undefined);
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: {
        setOnPlaybackStatusUpdate: jest.fn((cb) => {
          statusCallback = cb;
        }),
        unloadAsync: mockUnload,
      },
      status: { isLoaded: true },
    });

    await playCompletionSound();
    expect(statusCallback).toBeDefined();

    statusCallback({ isLoaded: true, didJustFinish: true });
    expect(mockUnload).toHaveBeenCalled();
  });

  it('does not unload if playback has not finished', async () => {
    let statusCallback: any;
    const mockUnload = jest.fn().mockResolvedValue(undefined);
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: {
        setOnPlaybackStatusUpdate: jest.fn((cb) => {
          statusCallback = cb;
        }),
        unloadAsync: mockUnload,
      },
      status: { isLoaded: true },
    });

    await playCompletionSound();
    expect(statusCallback).toBeDefined();

    statusCallback({ isLoaded: true, didJustFinish: false });
    expect(mockUnload).not.toHaveBeenCalled();
  });

  it('handles Audio errors gracefully without throwing', async () => {
    (Audio.Sound.createAsync as jest.Mock).mockRejectedValueOnce(new Error('Audio device error'));
    await expect(playCompletionSound()).resolves.toBeUndefined();
  });

  it('throttles rapid duplicate invocations within cooldown window', async () => {
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: {
        setOnPlaybackStatusUpdate: jest.fn(),
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      },
      status: { isLoaded: true },
    });

    await Promise.all([playCompletionSound(), playCompletionSound()]);
    expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1);
  });
});
