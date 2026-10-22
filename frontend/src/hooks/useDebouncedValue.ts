import { useEffect, useState } from 'react';

/** Devuelve `value` luego de `delayMs` sin cambios (búsqueda en tiempo real del catálogo). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
