/**
 * Mobile colour-scheme logic: palette parity between schemes, preference
 * validation and 'system' resolution. Mirrored on the web by
 * frontend/src/lib/theme.test.tsx.
 */
import { describe, expect, it } from '@jest/globals';
import { darkColors, lightColors } from './tokens';
import { isThemePreference, resolveScheme } from './theme';

describe('theme palettes', () => {
  it('light and dark define the identical colour keys', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('no palette entry is an empty or malformed colour string', () => {
    for (const palette of [darkColors, lightColors]) {
      for (const [key, value] of Object.entries(palette)) {
        expect(`palette entry ${key}=${value}`).toMatch(
          /^palette entry .*=(#[0-9a-f]{6}|rgba\(\d+(?:\.\d+)?, \d+(?:\.\d+)?, \d+(?:\.\d+)?, [01](?:\.\d+)?\))$/i,
        );
      }
    }
  });

  it('schemes differ on the identity colours (text/surface/background)', () => {
    expect(darkColors.bg).not.toEqual(lightColors.bg);
    expect(darkColors.text).not.toEqual(lightColors.text);
    expect(darkColors.surface).not.toEqual(lightColors.surface);
  });
});

describe('isThemePreference', () => {
  it('accepts only the shared contract values', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference('')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
    expect(isThemePreference({ theme: 'dark' })).toBe(false);
  });
});

describe('resolveScheme', () => {
  it('resolves system to the OS scheme and explicit choices through', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});
