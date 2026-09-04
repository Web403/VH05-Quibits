/**
 * Jest global setup.
 *
 * Replaces native/Expo modules with in-memory fakes so the suite runs in
 * plain Node: no device, no simulator, no backend, no Expo Go needed.
 */
type MockNetListener = (state: { isConnected?: boolean; isInternetReachable?: boolean | null }) => void;

// `mock`-prefixed module-scope variables are the sanctioned way to share state
// with jest.mock factories (babel-plugin-jest-hoist whitelist). Factories run
// lazily on first import, so these are initialized by then.
const mockSecureStore = new Map<string, string>();
const mockNetInfoListeners = new Set<MockNetListener>();
const { newInMemorySqlite } = require('./in-memory-sqlite') as typeof import('./in-memory-sqlite');
const mockSqlite = newInMemorySqlite();

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => `test-uuid-${String(++counter).padStart(6, '0')}`),
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
  __store: mockSecureStore,
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockSqlite),
  deleteDatabaseSync: jest.fn(),
  /** Test helper: clear all rows between tests (table definitions survive). */
  __resetAll: () => mockSqlite.reset(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((listener: (state: { isConnected?: boolean; isInternetReachable?: boolean | null }) => void) => {
      mockNetInfoListeners.add(listener);
      return () => mockNetInfoListeners.delete(listener);
    }),
    fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
  __listeners: mockNetInfoListeners,
}));

jest.mock('@react-native-community/datetimepicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', null, null),
  };
});

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }: Record<string, unknown>) => React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: jest.fn(() => '/'),
  useLocalSearchParams: jest.fn(() => ({})),
  useNavigation: jest.fn(() => ({ addListener: jest.fn(() => () => {}), dispatch: jest.fn() })),
  useFocusEffect: jest.fn(() => {}),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
  Redirect: () => null,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

// --- expo-camera: fake permission hook + a CameraView double that captures the
// scan handler so tests can fire barcodes without any device. ---------------
const mockCameraState: {
  permission: { granted: boolean; canAskAgain: boolean; status: string } | null;
  requestPermission: jest.Mock;
  lastScanHandler: ((result: { type: string; data: string }) => void) | undefined;
} = {
  permission: { granted: true, canAskAgain: true, status: 'granted' },
  requestPermission: jest.fn(),
  lastScanHandler: undefined,
};

jest.mock('expo-camera', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    CameraView: (props: { onBarcodeScanned?: (result: { type: string; data: string }) => void; children?: React.ReactNode }) => {
      mockCameraState.lastScanHandler = props.onBarcodeScanned;
      return React.createElement(View, { testID: 'camera-view' }, props.children ?? null);
    },
    useCameraPermissions: () => [mockCameraState.permission, mockCameraState.requestPermission],
    __mockCameraState: mockCameraState,
  };
});

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
}));

/** Test helper: steer the fake camera for one test, then reset in afterEach. */
export function setMockCameraPermission(permission: { granted: boolean; canAskAgain: boolean; status: string } | null): void {
  mockCameraState.permission = permission;
}

/** Test helper: fire a barcode at the mounted CameraView double. */
export function simulateScan(data: string): void {
  mockCameraState.lastScanHandler?.({ type: 'qr', data });
}

jest.mock('expo-router/entry', () => ({
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-constants', () => ({ default: { manifest: {} } }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'itp-mobile:///') }));

/** Test helper: emit a NetInfo state to all listeners. */
export function emitNetworkState(state: { isConnected?: boolean; isInternetReachable?: boolean | null }): void {
  for (const listener of mockNetInfoListeners) listener(state);
}

export function secureStoreContents(): Map<string, string> {
  return mockSecureStore;
}
