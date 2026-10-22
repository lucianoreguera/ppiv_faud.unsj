import { useEffect, useState } from 'react';

/** Devuelve true mientras la media query coincida (p. ej. '(max-width: 1023px)' para vistas mobile). */
export function useMediaQuery(query: string): boolean {
  const getMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState<boolean>(getMatch);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
