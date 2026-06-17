import { Alert, View } from 'react-native';
import { ActivityIndicator, IconButton } from 'react-native-paper';

import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';

export function LogoutHeaderButton(): React.JSX.Element {
  const { logout } = useAuth();
  const { syncing } = useOfflineSync();

  const confirmLogout = (): void => {
    Alert.alert(
      'Log out?',
      'Are you sure you want to log out of Klir Mobile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            void logout();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {syncing ? <ActivityIndicator size={18} /> : null}
      <IconButton
        icon="logout"
        size={24}
        style={{ marginRight: 0 }}
        accessibilityLabel="Log out"
        onPress={confirmLogout}
      />
    </View>
  );
}
