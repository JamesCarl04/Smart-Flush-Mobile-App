import { Alert } from 'react-native';
import { IconButton } from 'react-native-paper';

import { useAuth } from '../hooks/useAuth';

export function LogoutHeaderButton(): React.JSX.Element {
  const { logout } = useAuth();

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
    <IconButton
      icon="logout"
      size={24}
      style={{ marginRight: 0 }}
      accessibilityLabel="Log out"
      onPress={confirmLogout}
    />
  );
}
