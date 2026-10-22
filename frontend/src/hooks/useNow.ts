import { useEffect, useState } from 'react';

/** Reloj compartido para las cuentas regresivas: se actualiza cada `intervalMs` (por defecto, cada 30 s) */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
