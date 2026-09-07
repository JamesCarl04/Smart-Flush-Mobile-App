import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { apiFetch } from '../../lib/api';
import {
  unregisterPushNotificationsAsync,
} from '../../lib/notifications';
import { mockMessagingModule } from '../../jest.setup';

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

describe('notifications lifecycle unit tests', () => {
  const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unregisterPushNotificationsAsync', () => {
    it('calls unregister endpoint, deletes FCM token from messaging, and removes local token storage', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: true,
      });
      mockMessagingModule.deleteToken.mockResolvedValueOnce(undefined);

      await unregisterPushNotificationsAsync();

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/tasks/unregister-token', {
        method: 'POST',
      });
      expect(mockMessagingModule.deleteToken).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('fcmToken');
    });

    it('gracefully deletes local token and removes storage even if backend unregister endpoint fails', async () => {
      mockedApiFetch.mockRejectedValueOnce(new Error('Network error or server unavailable'));
      mockMessagingModule.deleteToken.mockResolvedValueOnce(undefined);

      await expect(unregisterPushNotificationsAsync()).resolves.toBeUndefined();

      expect(mockMessagingModule.deleteToken).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('fcmToken');
    });

    it('gracefully removes storage even if messaging().deleteToken throws', async () => {
      mockedApiFetch.mockResolvedValueOnce({ success: true });
      mockMessagingModule.deleteToken.mockRejectedValueOnce(new Error('FCM client unavailable'));

      await expect(unregisterPushNotificationsAsync()).resolves.toBeUndefined();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('fcmToken');
    });

    it('handles messaging() returning an object without deleteToken method without throwing', async () => {
      const originalMessaging = messaging();
      const tempDelete = (originalMessaging as any).deleteToken;
      delete (originalMessaging as any).deleteToken;

      try {
        mockedApiFetch.mockResolvedValueOnce({ success: true });
        await expect(unregisterPushNotificationsAsync()).resolves.toBeUndefined();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('fcmToken');
      } finally {
        (originalMessaging as any).deleteToken = tempDelete;
      }
    });
  });
});
