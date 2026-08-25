import '@testing-library/jest-native/extend-expect';

// 0. Mock Gesture Handler
try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // fallback if needed
}

// 1. Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// 2. Mock Expo Constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      backendApiBaseUrl: 'https://api.smartflush.example.com',
      expoProjectId: 'test-expo-project-id',
      firebase: {
        apiKey: 'mock-api-key',
        authDomain: 'mock-auth-domain.firebaseapp.com',
        projectId: 'mock-project-id',
        storageBucket: 'mock-bucket.firebasestorage.app',
        messagingSenderId: 'mock-sender-id',
        appId: 'mock-app-id',
      },
    },
  },
  easConfig: {
    projectId: 'test-expo-project-id',
  },
}));

// 3. Mock React Native Firebase Auth
const mockCurrentUser = {
  uid: 'user-123',
  email: 'technician@smartflush.com',
  displayName: 'Alex Technician',
  getIdToken: jest.fn().mockResolvedValue('mock-firebase-id-token'),
};

export const mockAuthModule = {
  currentUser: mockCurrentUser,
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockCurrentUser }),
  signOut: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  onAuthStateChanged: jest.fn((callback) => {
    callback(mockCurrentUser);
    return jest.fn(); // unsubscribe
  }),
};

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => mockAuthModule,
  getAuth: () => mockAuthModule,
  signInWithEmailAndPassword: jest.fn((_auth, email, pass) =>
    mockAuthModule.signInWithEmailAndPassword(email, pass),
  ),
  signOut: jest.fn(() => mockAuthModule.signOut()),
  sendPasswordResetEmail: jest.fn((_auth, email) =>
    mockAuthModule.sendPasswordResetEmail(email),
  ),
  onAuthStateChanged: jest.fn((_auth, callback) =>
    mockAuthModule.onAuthStateChanged(callback),
  ),
}));

// 4. Mock React Native Firebase Messaging
export const mockMessagingModule = {
  hasPermission: jest.fn().mockResolvedValue(1),
  requestPermission: jest.fn().mockResolvedValue(1),
  registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  setBackgroundMessageHandler: jest.fn(),
};

jest.mock('@react-native-firebase/messaging', () => {
  const messagingFn = () => mockMessagingModule;
  messagingFn.AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return {
    __esModule: true,
    default: messagingFn,
    AuthorizationStatus: messagingFn.AuthorizationStatus,
  };
});

// 5. Mock Firebase JS SDK (firestore, storage, app)
jest.mock('firebase/app', () => ({
  getApps: jest.fn().mockReturnValue([]),
  getApp: jest.fn().mockReturnValue({}),
  initializeApp: jest.fn().mockReturnValue({}),
  FirebaseError: class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    date: Date;
    constructor(date: Date) {
      this.date = date;
    }
    toDate() {
      return this.date;
    }
    static fromDate(date: Date) {
      return new MockTimestamp(date);
    }
    static now() {
      return new MockTimestamp(new Date());
    }
  }

  return {
    getFirestore: jest.fn().mockReturnValue({}),
    doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
    getDoc: jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ createdAt: new MockTimestamp(new Date('2026-08-15T08:00:00Z')) }),
    }),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    serverTimestamp: jest.fn(() => new MockTimestamp(new Date())),
    Timestamp: MockTimestamp,
  };
});

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn().mockReturnValue({}),
  ref: jest.fn((_storage, path) => ({ fullPath: path })),
  uploadBytes: jest.fn().mockResolvedValue({}),
  getDownloadURL: jest.fn().mockResolvedValue('https://storage.example.com/mock-photo.jpg'),
}));

// 5b. Mock React Native Firebase Storage
export const mockStorageRef = {
  putFile: jest.fn().mockResolvedValue({ state: 'success' }),
  getDownloadURL: jest.fn().mockResolvedValue('https://storage.example.com/mock-photo.jpg'),
};

export const mockStorageModule = {
  ref: jest.fn((path?: string) => ({
    ...mockStorageRef,
    fullPath: path,
  })),
};

jest.mock('@react-native-firebase/storage', () => {
  const storageFn = () => mockStorageModule;
  return {
    __esModule: true,
    default: storageFn,
    getStorage: () => mockStorageModule,
  };
});

// 5c. Mock React Native Firebase Firestore
class MockFirestoreTimestamp {
  date: Date;
  constructor(date: Date) {
    this.date = date;
  }
  toDate() {
    return this.date;
  }
  static fromDate(date: Date) {
    return new MockFirestoreTimestamp(date);
  }
  static now() {
    return new MockFirestoreTimestamp(new Date());
  }
}

export const mockFirestoreDoc = {
  update: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({ createdAt: new MockFirestoreTimestamp(new Date('2026-08-15T08:00:00Z')) }),
  }),
};

export const mockFirestoreCollection = {
  doc: jest.fn((_id?: string) => mockFirestoreDoc),
  get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
  onSnapshot: jest.fn((callback) => {
    callback({ empty: true, docs: [] });
    return jest.fn();
  }),
};

export const mockFirestoreModule = {
  collection: jest.fn((_name: string) => mockFirestoreCollection),
  doc: jest.fn((_path: string) => mockFirestoreDoc),
  batch: jest.fn(() => ({
    delete: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
};

const mockFirestoreExport = Object.assign(() => mockFirestoreModule, {
  Timestamp: MockFirestoreTimestamp,
  FieldValue: {
    serverTimestamp: jest.fn(() => new MockFirestoreTimestamp(new Date())),
  },
  getFirestore: () => mockFirestoreModule,
});

jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: mockFirestoreExport,
  getFirestore: () => mockFirestoreModule,
  Timestamp: MockFirestoreTimestamp,
  FieldValue: mockFirestoreExport.FieldValue,
}));

// 6. Mock Expo Network
jest.mock('expo-network', () => {
  let isConnected = true;
  let isInternetReachable = true;
  const listeners: Array<(state: any) => void> = [];

  return {
    getNetworkStateAsync: jest.fn().mockImplementation(async () => ({
      isConnected,
      isInternetReachable,
    })),
    addNetworkStateListener: jest.fn().mockImplementation((listener) => {
      listeners.push(listener);
      return {
        remove: () => {
          const index = listeners.indexOf(listener);
          if (index !== -1) listeners.splice(index, 1);
        },
      };
    }),
    __setNetworkState: (connected: boolean, reachable: boolean = true) => {
      isConnected = connected;
      isInternetReachable = reachable;
      listeners.forEach((l) => l({ isConnected: connected, isInternetReachable: reachable }));
    },
  };
});

// 7. Mock Expo Local Authentication (Biometrics)
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

// 8. Mock Expo Image Manipulator & View Shot
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'file:///mock/manipulated-image.jpg',
    width: 800,
    height: 600,
  }),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('file:///mock/captured-overlay.jpg'),
}));

// 9. Mock direct native module ExponentImagePicker
jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual('expo-modules-core');
  return {
    ...actual,
    requireNativeModule: jest.fn((moduleName: string) => {
      if (moduleName === 'ExponentImagePicker') {
        return {
          requestCameraPermissionsAsync: jest.fn().mockResolvedValue({
            status: 'granted',
            granted: true,
            canAskAgain: true,
            expires: 'never',
          }),
          launchCameraAsync: jest.fn().mockResolvedValue({
            canceled: false,
            assets: [
              {
                uri: 'file:///mock/raw-camera-photo.jpg',
                width: 1200,
                height: 900,
              },
            ],
          }),
        };
      }
      return {};
    }),
  };
});

// 10. Mock Safe Area Context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const SafeAreaInsetsContext = React.createContext(insets);
  const SafeAreaFrameContext = React.createContext(frame);
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaConsumer: ({ children }: any) => children(insets),
    SafeAreaView: ({ children, style }: any) =>
      React.createElement('SafeAreaView', { style }, children),
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    withSafeAreaInsets: (WrappedComponent: any) => (props: any) =>
      React.createElement(WrappedComponent, { ...props, insets }),
  };
});

// 11. Mock Expo Font & Vector Icons
jest.mock('expo-font', () => ({
  isLoaded: jest.fn().mockReturnValue(true),
  loadAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: any) =>
    React.createElement(Text, { testID: `icon-${props.name}`, ...props }, props.name);
  return {
    MaterialCommunityIcons: MockIcon,
    Ionicons: MockIcon,
    AntDesign: MockIcon,
    FontAwesome: MockIcon,
    Feather: MockIcon,
  };
});

// 12. Mock Expo Print, Sharing, and FileSystem
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({
    uri: 'file:///mock/cache/klir-report-mock.pdf',
    numberOfPages: 2,
  }),
  printAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockFileSystem = {
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('mock content'),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
};

jest.mock('expo-file-system', () => mockFileSystem);
jest.mock('expo-file-system/legacy', () => mockFileSystem);

// Global fetch mock helper
global.fetch = jest.fn();


