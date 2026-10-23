import { useCallback, useEffect, useState } from 'react';

const KEY = 'popcorn-theme';
const COLORS = { dark: '#0b0a09', light: '#ffffff' };

const read = () => {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

// Dark is the default; a choice made with the switch is remembered.
export function useTheme() {
  const [theme, setThemeState] = useState(read);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return [theme, setTheme];
}
