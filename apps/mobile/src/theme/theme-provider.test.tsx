/**
 * ThemeProvider behaviour with the real AuthProvider: server-preference
 * adoption, device-local kv persistence, and the PATCH mirror on change.
 * Native modules are faked by src/test/setup.ts; the auth API and the
 * preferences endpoint are mocked so no network is touched.
 */
import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '@/auth/auth-context';
import { ThemeProvider, useTheme } from './theme';
import { initDatabase, kvGet, kvSet } from '@/db/database';
import { writeSession, clearSession } from '@/auth/token-store';
import type { PublicUser } from '@itp/shared';

jest.mock('@/api/auth');

// Partial-mock the endpoints module so the provider's PATCH mirror is a spy
// while every other endpoint keeps its real implementation.
jest.mock('@/api/endpoints', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actual = jest.requireActual('@/api/endpoints') as object;
  return { ...actual, updateMyPreferences: jest.fn() };
});

const resetDb = (): void => (jest.requireMock('expo-sqlite') as { __resetAll: () => void }).__resetAll();

const { updateMyPreferences } = jest.requireMock('@/api/endpoints') as {
  updateMyPreferences: jest.Mock;
};
const { fetchMe } = jest.requireMock('@/api/auth') as { fetchMe: jest.Mock };

const THEME_KV_KEY = 'prefs.theme';

const USER: PublicUser = {
  id: 'user-theme-1',
  username: 'tech',
  email: 'tech@example.com',
  fullName: 'T Ech',
  role: 'technician',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  preferences: { theme: 'dark', locale: 'en' },
};

function Probe(): React.JSX.Element {
  const { preference, scheme, setPreference } = useTheme();
  return (
    <>
      <Text testID="pref">{preference}</Text>
      <Text testID="scheme">{scheme}</Text>
      <Pressable testID="to-light" onPress={() => setPreference('light')}>
        <Text>Light</Text>
      </Pressable>
    </>
  );
}

function renderTree(): ReturnType<typeof render> {
  return render(
    <AuthProvider>
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    </AuthProvider>,
  );
}

describe('ThemeProvider with AuthProvider', () => {
  beforeEach(async () => {
    resetDb();
    initDatabase();
    await clearSession();
    fetchMe.mockReset();
    updateMyPreferences.mockReset();
    updateMyPreferences.mockImplementation(async (preferences: unknown) => ({
      ...USER,
      preferences: preferences as PublicUser['preferences'],
    }));
  });

  it('adopts the theme stored on the signed-in profile and mirrors it to kv', async () => {
    fetchMe.mockResolvedValue(USER);
    await writeSession({ accessToken: 'a1', refreshToken: 'r1', user: USER });
    const { getByTestId } = renderTree();
    await waitFor(() => expect(getByTestId('pref').props.children).toBe('dark'));
    expect(getByTestId('scheme').props.children).toBe('dark');
    expect(kvGet(USER.id, THEME_KV_KEY)).toBe('dark');
  });

  it('falls back to the per-user kv preference when the profile has none', async () => {
    const noPrefs: PublicUser = { ...USER, preferences: null };
    fetchMe.mockResolvedValue(noPrefs);
    // Seed a remembered device choice for this user, then sign them in.
    kvSet(USER.id, THEME_KV_KEY, 'light');
    await writeSession({ accessToken: 'a1', refreshToken: 'r1', user: noPrefs });
    const { getByTestId } = renderTree();
    await waitFor(() => expect(getByTestId('pref').props.children).toBe('light'));
  });

  it('setPreference persists per user, mirrors to the server, and merges preferences', async () => {
    fetchMe.mockResolvedValue(USER);
    await writeSession({ accessToken: 'a1', refreshToken: 'r1', user: USER });
    const { getByTestId } = renderTree();
    await waitFor(() => expect(getByTestId('pref').props.children).toBe('dark'));
    await act(async () => {
      fireEvent.press(getByTestId('to-light'));
    });
    expect(getByTestId('pref').props.children).toBe('light');
    expect(getByTestId('scheme').props.children).toBe('light');
    expect(kvGet(USER.id, THEME_KV_KEY)).toBe('light');
    expect(updateMyPreferences).toHaveBeenCalledTimes(1);
    // merge contract: existing keys (locale) survive the wholesale replace.
    expect(updateMyPreferences).toHaveBeenCalledWith({ locale: 'en', theme: 'light' });
  });

  it('works signed-out on the device scope without any API call', async () => {
    const { getByTestId } = renderTree();
    await act(async () => {
      fireEvent.press(getByTestId('to-light'));
    });
    expect(getByTestId('pref').props.children).toBe('light');
    expect(kvGet('__device__', THEME_KV_KEY)).toBe('light');
    expect(updateMyPreferences).not.toHaveBeenCalled();
  });
});
