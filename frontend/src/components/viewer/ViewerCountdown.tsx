import React from 'react';
import { Clock } from 'lucide-react';
import { useNow } from '../../hooks/useNow';
import { formatCountdown } from '../../utils/loan-time';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Reloj de cuenta regresiva del Visor Protegido (barra superior, Figma pág. 14).
 * Se actualiza cada 30 s y, en la última hora, cada segundo. Pasa al tono de alerta dentro de las últimas 24 h (RF06).
 */
export const ViewerCountdown: React.FC<{ expiresAt: number }> = ({ expiresAt }) => {
  const remainingAtRender = expiresAt - Date.now();
  const now = useNow(remainingAtRender <= HOUR ? 1000 : 30_000);
  const remaining = Math.max(0, expiresAt - now);
  const within24h = remaining <= DAY;
  const text = formatCountdown(remaining);

  return (
    <span
      role="timer"
      aria-label={`Tiempo restante del préstamo: ${text}`}
      className={`justify-self-end inline-flex items-center gap-1.5 h-6 lg:h-7 px-3 lg:px-4 rounded-pill text-[10px] lg:text-caption font-bold whitespace-nowrap ${
        within24h ? 'bg-status-danger-bg text-status-danger' : 'bg-faud-amber text-faud-ink'
      }`}
    >
      <Clock className="w-3.5 h-3.5 hidden sm:block" aria-hidden="true" />
      {within24h ? 'Por vencer' : 'Vigente'} · vence en {text}
    </span>
  );
};
