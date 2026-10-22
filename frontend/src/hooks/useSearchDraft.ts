import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Búsqueda libre en vivo sincronizada con la URL (tablas del panel admin):
 * el borrador se confirma con `commit` tras `delayMs` sin cambios, y vuelve a copiar la URL
 * cuando esta cambia desde afuera (atrás/adelante del navegador o "Limpiar filtros").
 */
export function useSearchDraft(urlValue: string | undefined, commit: (q: string | undefined) => void, delayMs = 350) {
  const [draft, setDraft] = useState(urlValue ?? '');
  const debounced = useDebouncedValue(draft, delayMs);
  const urlRef = useRef(urlValue);
  const commitRef = useRef(commit);
  urlRef.current = urlValue;
  commitRef.current = commit;

  useEffect(() => {
    const q = debounced.trim() || undefined;
    if (q !== urlRef.current) commitRef.current(q);
  }, [debounced]);

  useEffect(() => {
    setDraft((current) => (current.trim() === (urlValue ?? '') ? current : (urlValue ?? '')));
  }, [urlValue]);

  return [draft, setDraft] as const;
}
