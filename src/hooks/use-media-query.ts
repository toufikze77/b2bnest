import { useEffect, useState } from 'react';

/** True while the media query matches. Starts false where matchMedia is unavailable. */
export function useMediaQuery(query: string) {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/** Phone layout: below Tailwind's md breakpoint. */
export const usePhone = () => useMediaQuery('(max-width: 767px)');
