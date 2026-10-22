import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { healthApi } from '../../api/health.api';
import type { HealthResponseDto } from '../../types/openapi.types';

export interface HealthStatusBadgeProps {
  onHealthUpdate?: (health: HealthResponseDto | null, error: string | null) => void;
}

export const HealthStatusBadge: React.FC<HealthStatusBadgeProps> = ({ onHealthUpdate }) => {
  const [health, setHealth] = useState<HealthResponseDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkBackendHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await healthApi.checkHealth();
      setHealth(response);
      setError(null);
      onHealthUpdate?.(response, null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo conectar con /api/v1/health';
      setHealth(null);
      setError(msg);
      onHealthUpdate?.(null, msg);
    } finally {
      setLoading(false);
    }
  }, [onHealthUpdate]);

  useEffect(() => {
    void checkBackendHealth();
  }, [checkBackendHealth]);

  const isUp = health?.status === 'ok' && health?.database?.status === 'up';

  return (
    <button
      type="button"
      onClick={() => void checkBackendHealth()}
      title={
        isUp
          ? `Conectado a ${health?.service} (v${health?.version}) — PostgreSQL ${health?.database?.status.toUpperCase()} (${health?.database?.latencyMs ?? 0} ms). Clic para actualizar.`
          : error || 'Verificando estado de /api/v1/health...'
      }
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[15px] text-xs font-semibold border transition-all ${
        loading
          ? 'bg-[#16213E] text-[#F5F0E1]/80 border-[#FFB606]/30'
          : isUp
            ? 'bg-[#E6F4EA] text-[#2D6A4F] border-[#2D6A4F]/30 hover:bg-[#d5ede0]'
            : 'bg-[#FFF4E0] text-[#9A5B00] border-[#9A5B00]/30 hover:bg-[#fceacc]'
      }`}
    >
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FFB606]" />
      ) : isUp ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F]" />
      ) : error ? (
        <AlertTriangle className="w-3.5 h-3.5 text-[#9A5B00]" />
      ) : (
        <Activity className="w-3.5 h-3.5 text-[#FFB606]" />
      )}

      <span className="font-mono">
        {loading
          ? 'API /health...'
          : isUp
            ? `API Online · DB ${health?.database.latencyMs ?? 0}ms`
            : 'API Offline'}
      </span>
    </button>
  );
};
