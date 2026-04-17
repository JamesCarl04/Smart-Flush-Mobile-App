import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '../lib/firebase';
import type { AuthContextValue, AuthUser } from '../types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function safeSignOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('Failed to sign out', error);
  }
}

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AuthUser['role'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const profileSnapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
        const profileData = profileSnapshot.data();
        const firestoreRole = profileData?.role;

        if (firestoreRole !== 'maintenance') {
          setUser(null);
          setRole(null);
          Alert.alert(
            'Access denied',
            'Access denied. This app is for maintenance personnel only.',
          );
          await safeSignOut();
          return;
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          role: 'maintenance',
        });
        setRole('maintenance');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to verify your maintenance account.';

        setUser(null);
        setRole(null);
        Alert.alert('Authentication error', message);
        await safeSignOut();
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const logout = async (): Promise<void> => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
