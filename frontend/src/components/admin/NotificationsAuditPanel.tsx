import React, { useEffect, useRef, useState } from 'react';
import { BellOff } from 'lucide-react';
import { notificationsApi } from '../../api/notifications.api';
import { NOTIFICATION_META, notificationText } from '../notifications/notification-meta';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/FormField';
import { Pagination } from '../ui/Pagination';
import { useToast } from '../../context/ToastContext';
import { describeApiError } from '../../utils/api-error';
import { formatDateTime } from '../../utils/loan-time';
import {
  TIPOS_NOTIFICACION,
  type AdminNotificationsFilterParams,
  type NotificationsListResponseDto,
  type TipoNotificacion,
} from '../../types/openapi.types';

/**
 * Auditoría global de notificaciones (GET /api/v1/notificaciones/admin — RF06):
 * permite comprobar en vivo los avisos que generan el préstamo, la revocación y el control de vigencia (Figura 4).
 */
export interface NotificationsAuditPanelProps {
  params: AdminNotificationsFilterParams;
  /** Se incrementa para volver a consultar (p. ej. después de ejecutar el control de vigencia) */
  version: number;
  onFiltersChange: (patch: { tipo?: TipoNotificacion; leida?: boolean; page?: number }) => void;
}

type PanelState =
  | { status: 'loading' }
  | { status: 'ready'; data: NotificationsListResponseDto }
  | { status: 'error'; message: string };

const LEIDA_OPTIONS = [
  { value: 'no', label: 'No leídas por el usuario' },
  { value: 'si', label: 'Leídas por el usuario' },
];

export const NotificationsAuditPanel: React.FC<NotificationsAuditPanelProps> = ({ params, version, onFiltersChange }) => {
  const { showToast } = useToast();
  const [state, setState] = useState<PanelState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const hasDataRef = useRef(false);
  const apiKey = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    notificationsApi
      .adminList(JSON.parse(apiKey) as AdminNotificationsFilterParams, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        hasDataRef.current = true;
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (hasDataRef.current) {
          showToast({ title: 'No pudimos actualizar la auditoría', description: describeApiError(error), variant: 'error' });
          return;
        }
        setState({ status: 'error', message: describeApiError(error) });
      });
    return () => controller.abort();
  }, [apiKey, version, reloadToken, showToast]);

  const data = state.status === 'ready' ? state.data : null;
  const tipoOptions = TIPOS_NOTIFICACION.map((tipo) => ({
    value: tipo,
    label: data ? `${NOTIFICATION_META[tipo].label} (${data.contadores.porTipo[tipo] ?? 0})` : NOTIFICATION_META[tipo].label,
  }));

  return (
    <section aria-label="Auditoría de notificaciones">
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <SelectField
          aria-label="Tipo de aviso"
          wrapperClassName="sm:w-[300px]"
          placeholder="Todos los tipos de aviso"
          options={tipoOptions}
          value={params.tipo ?? ''}
          onChange={(e) => onFiltersChange({ tipo: (e.target.value || undefined) as TipoNotificacion | undefined })}
        />
        <SelectField
          aria-label="Lectura"
          wrapperClassName="sm:w-[260px]"
          placeholder="Leídas y no leídas"
          options={LEIDA_OPTIONS}
          value={params.leida === undefined ? '' : params.leida ? 'si' : 'no'}
          onChange={(e) =>
            onFiltersChange({ leida: e.target.value === '' ? undefined : e.target.value === 'si' })
          }
        />
        {data && (
          <p className="sm:ml-auto self-center text-caption text-faud-muted">
            {data.contadores.total} avisos en el sistema · {data.contadores.noLeidas} sin leer
          </p>
        )}
      </div>

      {state.status === 'loading' && (
        <div role="status" className="mt-5 space-y-3 animate-pulse">
          <span className="sr-only">Cargando auditoría de notificaciones…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-card bg-white border border-faud-border-warm" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-5">
          <Alert variant="danger" title="No pudimos cargar la auditoría de notificaciones">
            {state.message}
          </Alert>
          <Button
            className="mt-4"
            onClick={() => {
              setState({ status: 'loading' });
              setReloadToken((t) => t + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-5 rounded-card border border-faud-border-warm bg-white px-6 py-10 text-center">
          <BellOff className="w-8 h-8 mx-auto text-faud-gold-dark" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 text-body text-faud-muted">No hay notificaciones registradas con estos filtros.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <ul aria-label="Notificaciones enviadas" className="mt-5 bg-white rounded-card border border-faud-border-warm divide-y divide-dashed divide-faud-border-warm">
            {data.items.map((n) => {
              const meta = NOTIFICATION_META[n.tipo];
              const Icon = meta.icon;
              return (
                <li key={n.id} className="flex items-start gap-3 lg:gap-4 px-4 lg:px-6 py-4">
                  <span className={`inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full ${meta.tone}`}>
                    <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[15px] font-bold text-faud-ink">{meta.label}</p>
                      <span className="text-caption text-faud-muted">{formatDateTime(n.fechaEnvio)}</span>
                      <Badge variant={n.leida ? 'inactive' : 'warning'} size="xs" className="ml-auto">
                        {n.leida ? 'Leída' : 'No leída'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-body text-faud-text">{notificationText(n)}</p>
                    <p className="mt-1 text-caption text-faud-muted">
                      {n.prestamo.usuario.nombre} ({n.prestamo.usuario.departamentoNombre}) · {n.prestamo.usuario.email} ·
                      Préstamo {n.prestamo.codigoFormateado}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination
            className="mt-6"
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={(page) => onFiltersChange({ page })}
          />
        </>
      )}
    </section>
  );
};
