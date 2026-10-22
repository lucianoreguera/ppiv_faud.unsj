import { useEffect, useState } from 'react';
import { departmentsApi } from '../api/departments.api';
import type { TerritorialMetricsResponseDto } from '../types/openapi.types';

export interface TerritorialMetricsState {
  status: 'loading' | 'ready' | 'error';
  data: TerritorialMetricsResponseDto | null;
}

/** Alcance interdepartamental desde GET /api/v1/departamentos/metricas (portada y catálogo) */
export function useTerritorialMetrics(): TerritorialMetricsState {
  const [state, setState] = useState<TerritorialMetricsState>({ status: 'loading', data: null });

  useEffect(() => {
    const controller = new AbortController();
    departmentsApi
      .metrics(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error', data: null });
      });
    return () => controller.abort();
  }, []);

  return state;
}
