import { useCallback, useEffect, useState } from 'react';

const KEY = 'popcorn-theme';
const COLORS = { dark: '#000000', light: '#ffffff' };

const read = () => {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
};

// Light is the default; a choice made with the switch is remembered.
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

// The theme currently shown ('dark' or 'light'), for components that take a theme prop.
export function useThemeName() {
  const read = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const [name, setName] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setName(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return name;
}
