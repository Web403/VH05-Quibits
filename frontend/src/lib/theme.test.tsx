/**
 * Colour-scheme routes: preference resolution, document application, device
 * persistence, adoption of the server-stored profile preference, and the
 * system-appearance live re-resolution.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { ThemeProvider, resolveTheme, useTheme } from './theme';

type MqlListener = (event: { matches: boolean }) => void;

function installMatchMedia(initial: { light: boolean }): {
  setLight: (v: boolean) => void;
  listeners: Set<MqlListener>;
} {
  const listeners = new Set<MqlListener>();
  let light = initial.light;
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: light)' ? light : false;
      },
      media: query,
      addEventListener: (_: string, cb: MqlListener) => listeners.add(cb),
      removeEventListener: (_: string, cb: MqlListener) => listeners.delete(cb),
    })),
  );
  return {
    listeners,
    setLight(v: boolean) {
      light = v;
      listeners.forEach((cb) => cb({ matches: v }));
    },
  };
}

function Probe(): JSX.Element {
  const { preference, scheme, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="scheme">{scheme}</span>
      <button type="button" onClick={() => setPreference('light')}>
        to-light
      </button>
    </div>
  );
}

function renderWithTheme(userJson?: string): void {
  if (userJson) {
    sessionStorage.setItem('itp.accessToken', 'token');
    sessionStorage.setItem('itp.user', userJson);
  }
  render(
    <MemoryRouter>
      <AuthProvider>
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const BASE_USER = {
  id: 'u1',
  username: 'tech',
  email: 'tech@example.test',
  fullName: 'Tech',
  role: 'technician',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('resolveTheme', () => {
  it('resolves system to the OS scheme and passes explicit choices through', () => {
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to the system scheme and applies data-theme to <html>', () => {
    installMatchMedia({ light: false });
    renderWithTheme();
    expect(screen.getByTestId('pref')).toHaveTextContent('system');
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('restores a stored device preference on load', () => {
    installMatchMedia({ light: false });
    localStorage.setItem('itp.theme', 'light');
    renderWithTheme();
    expect(screen.getByTestId('scheme')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('ignores junk values in storage', () => {
    installMatchMedia({ light: false });
    localStorage.setItem('itp.theme', 'sepia');
    renderWithTheme();
    expect(screen.getByTestId('pref')).toHaveTextContent('system');
  });

  it('persists the choice and flips the document on setPreference', async () => {
    installMatchMedia({ light: false });
    renderWithTheme();
    await userEvent.click(screen.getByRole('button', { name: 'to-light' }));
    expect(localStorage.getItem('itp.theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('re-resolves when the OS scheme changes under the system preference', () => {
    const mql = installMatchMedia({ light: false });
    renderWithTheme();
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
    act(() => mql.setLight(true));
    expect(screen.getByTestId('scheme')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('keeps an explicit choice when the OS scheme changes', () => {
    const mql = installMatchMedia({ light: true });
    localStorage.setItem('itp.theme', 'dark');
    renderWithTheme();
    act(() => mql.setLight(false));
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
  });

  it('adopts the theme stored on the signed-in profile', () => {
    installMatchMedia({ light: false });
    renderWithTheme(JSON.stringify({ ...BASE_USER, preferences: { theme: 'light' } }));
    expect(screen.getByTestId('pref')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('itp.theme')).toBe('light');
  });
});
