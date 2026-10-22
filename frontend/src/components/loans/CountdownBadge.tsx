import React from 'react';
import { Badge } from '../ui/Badge';
import { elapsedRatio } from '../../utils/loan-time';
import type { LoanItemDto } from '../../types/openapi.types';
import type { LoanStatusView } from './loan-status';

/** Badge de estado con cuenta regresiva y barra de vigencia de los 7 días (RF03 · alerta temprana 24h RF06) */
export const CountdownBadge: React.FC<{
  loan: LoanItemDto;
  status: LoanStatusView;
  now: number;
  size?: 'xs' | 'sm';
}> = ({ loan, status, now, size = 'sm' }) => {
  const remainingPct = Math.round((1 - elapsedRatio(loan, now)) * 100);
  return (
    <div className="inline-flex flex-col gap-1.5">
      <Badge variant={status.variant} size={size} dot={status.porVencer}>
        {status.label}
      </Badge>
      {status.readable && (
        <div
          role="progressbar"
          aria-label={`Vigencia restante del préstamo ${loan.codigoFormateado}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={remainingPct}
          className="h-1 w-full min-w-[120px] rounded-full bg-faud-border-warm overflow-hidden"
        >
          <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${remainingPct}%` }} />
        </div>
      )}
    </div>
  );
};
