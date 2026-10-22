import { useEffect, useState } from 'react';
import { departmentsApi } from '../api/departments.api';
import type { SelectOption } from '../components/ui/FormField';

export interface DepartmentOptionsState {
  status: 'loading' | 'ready' | 'error';
  options: SelectOption[];
}

/** Los 19 departamentos de San Juan (Capital primero) como opciones de filtro / formulario del panel admin */
export function useDepartmentOptions(): DepartmentOptionsState {
  const [state, setState] = useState<DepartmentOptionsState>({ status: 'loading', options: [] });

  useEffect(() => {
    const controller = new AbortController();
    departmentsApi
      .list(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', options: items.map((d) => ({ value: d.id, label: d.nombre })) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error', options: [] });
      });
    return () => controller.abort();
  }, []);

  return state;
}
