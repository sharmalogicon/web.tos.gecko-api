"use client";
import { useCallback, useEffect, useState } from 'react';

/**
 * WHAT THIS BROWSER REMEMBERS ABOUT THE PERSON USING IT.
 *
 * Theme and language are per-person, not per-tenant: two clerks sharing a depot
 * account can want different ones, and neither is worth a round trip. They live
 * in localStorage, which means THIS BROWSER ONLY — a clerk who signs in at
 * another lane starts on the defaults again.
 *
 * That is a real limitation and the right place to fix it is the API: a
 * `preferences` object on /auth/me, written back by the account menu. Until
 * that exists the settings screen says so rather than implying the choice
 * follows the person around. See docs/USER_PREFERENCES_FOR_API.md.
 *
 * Every read and write is wrapped: localStorage throws in a private window and
 * can come back empty after a clear, and a preference is never worth a crash.
 */

export type Theme = 'light' | 'dark';
export type Language = 'en' | 'th';

export const LANGUAGES: { value: Language; label: string; english: string }[] = [
  { value: 'en', label: 'English', english: 'English' },
  { value: 'th', label: 'ไทย', english: 'Thai' },
];

const THEME_KEY = 'gecko.theme';
const LANG_KEY = 'gecko.language';

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* private window: the choice simply does not persist */ }
}

/**
 * ANOTHER PER-DEVICE CONVENIENCE, through the same guarded pair.
 *
 * The yard's handheld remembers which machine the cab drives, so a driver does
 * not pick it on every job (`MACHINE_PREFERENCE_KEY`). It is the same kind of
 * thing as the theme: THIS BROWSER ONLY, never sent anywhere, and the screen
 * must work when it comes back empty — which it does in a private window, with
 * site data cleared, and on the server, where there is no localStorage at all.
 *
 * Nothing that matters may live here. A choice the next shift has to see goes
 * to the API.
 */
export const readPreference = (key: string): string | null =>
  typeof window === 'undefined' ? null : read(key);

export const writePreference = (key: string, value: string): void => {
  if (typeof window !== 'undefined') write(key, value);
};

/**
 * Put the choices on the document.
 *
 * `data-theme` is what the stylesheet's dark rules key off; `lang` is what a
 * screen reader and the browser's own translate prompt read. Both are set on
 * <html>, which is why this is a side effect and not a React context.
 */
function apply(theme: Theme, language: Language): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('lang', language);
}

export const storedTheme = (): Theme => (read(THEME_KEY) === 'dark' ? 'dark' : 'light');
export const storedLanguage = (): Language => (read(LANG_KEY) === 'th' ? 'th' : 'en');

/**
 * The preferences, and the two setters that persist them.
 *
 * It starts on the DEFAULTS and reads the stored values in an effect rather
 * than during render: the server renders with no localStorage, so seeding state
 * from it directly would make the first client render disagree with the HTML
 * and React would complain about the mismatch.
 */
export function usePreferences() {
  const [theme, setThemeState] = useState<Theme>('light');
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const t = storedTheme();
    const l = storedLanguage();
    setThemeState(t);
    setLanguageState(l);
    apply(t, l);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    write(THEME_KEY, next);
    apply(next, storedLanguage());
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    write(LANG_KEY, next);
    apply(storedTheme(), next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(storedTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return { theme, language, setTheme, setLanguage, toggleTheme };
}
