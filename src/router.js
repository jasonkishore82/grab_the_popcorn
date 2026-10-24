import { useEffect, useState } from 'react';

// Minimal hash router: #/path/param
export function useRoute() {
  const read = () => (window.location.hash.slice(1) || '/').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (path) => (window.location.hash = path);
