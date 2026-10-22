import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BellOff, CheckCheck, Mail, MailOpen } from 'lucide-react';
import { notificationsApi } from '../../api/notifications.api';
import { ApiHttpError } from '../../api/http-client';
import { NOTIFICATION_META, notificationText } from '../../components/notifications/notification-meta';
import { Alert } from '../../components/ui/Alert';
import { TabPill } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/FormField';
import { Pagination } from '../../components/ui/Pagination';
import { useNotifications } from '../../context/NotificationsContext';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, formatRelative } from '../../utils/loan-time';
import {
  TIPOS_NOTIFICACION,
  type NotificationItemDto,
  type NotificationsFilterParams,
  type NotificationsListResponseDto,
  type TipoNotificacion,
} from '../../types/openapi.types';

/**
 * Bandeja de notificaciones (Spec FE-03, regla 4 · RF06) — GET /api/v1/notificaciones
 * Filtros sincronizados con la URL: `?estado=no-leidas|leidas&tipo=<TipoNotificacion>&page=N`.
 * Marcar leída / no leída: PATCH /api/v1/notificaciones/:id/leida · todas: PATCH /api/v1/notificaciones/marcar-todas-leidas.
 */
const PAGE_SIZE = 20;

type ReadFilter = 'todas' | 'no-leidas' | 'leidas';

const READ_TABS: { id: ReadFilter; label: string; count: (c: NotificationsListResponseDto['contadores']) => number }[] = [
  { id: 'todas', label: 'Todas', count: (c) => c.total },
  { id: 'no-leidas', label: 'No leídas', count: (c) => c.noLeidas },
  { id: 'leidas', label: 'Leídas', count: (c) => c.leidas },
];

export interface NotificationsQuery {
  estado: ReadFilter;
  tipo?: TipoNotificacion;
  page: number;
}

export function parseNotificationsParams(params: URLSearchParams): NotificationsQuery {
  const estado = params.get('estado');
  const tipo = params.get('tipo');
  const page = Number(params.get('page'));
  return {
    estado: estado === 'no-leidas' || estado === 'leidas' ? estado : 'todas',
    tipo: TIPOS_NOTIFICACION.includes(tipo as TipoNotificacion) ? (tipo as TipoNotificacion) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function toNotificationsApiParams(query: NotificationsQuery): NotificationsFilterParams {
  return {
    leida: query.estado === 'todas' ? undefined : query.estado === 'leidas',
    tipo: query.tipo,
    page: query.page,
    limit: PAGE_SIZE,
  };
}

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; data: NotificationsListResponseDto }
  | { status: 'error'; message: string };

const errorMessage = (error: unknown) =>
  error instanceof ApiHttpError && error.code === 'NETWORK_ERROR'
    ? 'No pudimos comunicarnos con el Repositorio FAUD. Verificá tu conexión e intentá nuevamente.'
    : error instanceof Error
      ? error.message
      : 'Intentá nuevamente en unos instantes.';

const NotificationRow: React.FC<{
  n: NotificationItemDto;
  busy: boolean;
  onToggleRead: (n: NotificationItemDto) => void;
}> = ({ n, busy, onToggleRead }) => {
  const meta = NOTIFICATION_META[n.tipo];
  const Icon = meta.icon;
  return (
    <li
      aria-label={`${meta.label} · ${n.prestamo.codigoFormateado}${n.leida ? '' : ' · No leída'}`}
      className={`relative flex items-start gap-3 lg:gap-4 rounded-card border bg-white px-4 lg:px-6 py-4 ${
        n.leida ? 'border-faud-border-warm' : 'border-faud-amber/70 shadow-card'
      }`}
    >
      {!n.leida && <span aria-hidden="true" className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r bg-faud-amber" />}
      <span className={`inline-flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 shrink-0 rounded-full ${meta.tone}`}>
        <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h2 className={`text-[15px] text-faud-ink ${n.leida ? 'font-medium' : 'font-bold'}`}>{meta.label}</h2>
          <span className="text-caption text-faud-muted" title={formatDateTime(n.fechaEnvio)}>
            {formatRelative(n.fechaEnvio)}
          </span>
        </div>
        <p className="mt-1 text-body text-faud-text">{notificationText(n)}</p>
        <p className="mt-1 text-caption text-faud-muted">
          Préstamo {n.prestamo.codigoFormateado} · {n.prestamo.documento.titulo}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to={meta.to} className="text-caption font-bold text-faud-gold-dark hover:text-faud-ink">
            {n.tipo === 'CUENTA_APROBADA' ? 'Explorar el catálogo' : 'Ver en Mis préstamos'}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleRead(n)}
            className="inline-flex items-center gap-1.5 text-caption font-bold text-faud-muted hover:text-faud-ink disabled:opacity-50"
          >
            {n.leida ? <Mail className="w-4 h-4" aria-hidden="true" /> : <MailOpen className="w-4 h-4" aria-hidden="true" />}
            {n.leida ? 'Marcar como no leída' : 'Marcar como leída'}
          </button>
        </div>
      </div>
    </li>
  );
};

export const NotificationsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseNotificationsParams(searchParams);
  const { version, markRead, markAllRead } = useNotifications();
  const { showToast } = useToast();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const hasDataRef = useRef(false);
  const apiKey = JSON.stringify(toNotificationsApiParams(query));

  useEffect(() => {
    const controller = new AbortController();
    notificationsApi
      .list(JSON.parse(apiKey) as NotificationsFilterParams, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        hasDataRef.current = true;
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (hasDataRef.current) {
          showToast({ title: 'No pudimos actualizar la bandeja', description: errorMessage(error), variant: 'error' });
          return;
        }
        setState({ status: 'error', message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [apiKey, version, reloadToken, showToast]);

  const updateQuery = (patch: Partial<NotificationsQuery>) => {
    const next = { ...query, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.estado !== 'todas') params.set('estado', next.estado);
    if (next.tipo) params.set('tipo', next.tipo);
    if (next.page > 1) params.set('page', String(next.page));
    setSearchParams(params);
  };

  const toggleRead = async (n: NotificationItemDto) => {
    setBusyId(n.id);
    try {
      await markRead(n.id, !n.leida);
    } catch (error) {
      showToast({ title: 'No pudimos actualizar la notificación', description: errorMessage(error), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      const actualizadas = await markAllRead();
      showToast({
        title: actualizadas === 1 ? '1 notificación marcada como leída' : `${actualizadas} notificaciones marcadas como leídas`,
        variant: 'success',
      });
    } catch (error) {
      showToast({ title: 'No pudimos marcar las notificaciones', description: errorMessage(error), variant: 'error' });
    } finally {
      setMarkingAll(false);
    }
  };

  const data = state.status === 'ready' ? state.data : null;
  const contadores = data?.contadores;
  const tipoOptions = TIPOS_NOTIFICACION.map((tipo) => ({
    value: tipo,
    label: contadores ? `${NOTIFICATION_META[tipo].label} (${contadores.porTipo[tipo] ?? 0})` : NOTIFICATION_META[tipo].label,
  }));
  const filtered = query.estado !== 'todas' || Boolean(query.tipo);

  return (
    <div className="max-w-[960px] mx-auto px-5 lg:px-0 pt-4 lg:pt-12 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-6">
        <div className="flex-1">
          <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-ink leading-tight">Notificaciones</h1>
          <p className="text-caption lg:text-[16px] text-faud-muted">
            Avisos de tus préstamos: otorgamiento, recordatorio 24 horas antes del vencimiento, vencimiento y revocación.
          </p>
        </div>
        <Button
          variant="secondary"
          leftIcon={<CheckCheck className="w-4 h-4" />}
          onClick={handleMarkAll}
          isLoading={markingAll}
          disabled={!contadores || contadores.noLeidas === 0}
        >
          Marcar todas como leídas{contadores && contadores.noLeidas > 0 ? ` (${contadores.noLeidas})` : ''}
        </Button>
      </div>

      <div className="mt-4 lg:mt-6 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
        <div role="tablist" aria-label="Estado de lectura" className="flex gap-2 overflow-x-auto no-scrollbar">
          {READ_TABS.map((t) => (
            <TabPill key={t.id} active={query.estado === t.id} onClick={() => updateQuery({ estado: t.id })}>
              {t.label}
              {contadores && ` (${t.count(contadores)})`}
            </TabPill>
          ))}
        </div>
        <SelectField
          label="Tipo de aviso"
          plainLabel
          wrapperClassName="lg:ml-auto lg:w-[280px]"
          placeholder="Todos los tipos"
          options={tipoOptions}
          value={query.tipo ?? ''}
          onChange={(e) => updateQuery({ tipo: (e.target.value || undefined) as TipoNotificacion | undefined })}
        />
      </div>

      {state.status === 'loading' && (
        <div role="status" className="mt-6 space-y-3 animate-pulse">
          <span className="sr-only">Cargando notificaciones…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-card bg-white border border-faud-border-warm" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-6">
          <Alert variant="danger" title="No pudimos cargar tus notificaciones">
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
        <section className="mt-6 rounded-card border border-faud-border-warm bg-white px-6 py-10 text-center">
          <BellOff className="w-9 h-9 mx-auto text-faud-gold-dark" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 text-body text-faud-muted">
            {filtered ? 'No hay notificaciones con estos filtros.' : 'Todavía no recibiste notificaciones.'}
          </p>
          {filtered && (
            <Button variant="secondary" className="mt-4" onClick={() => setSearchParams(new URLSearchParams())}>
              Ver todas
            </Button>
          )}
        </section>
      )}

      {data && data.items.length > 0 && (
        <>
          <ul aria-label="Notificaciones" className="mt-6 space-y-3">
            {data.items.map((n) => (
              <NotificationRow key={n.id} n={n} busy={busyId === n.id} onToggleRead={toggleRead} />
            ))}
          </ul>
          <Pagination
            className="mt-6"
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={(page) => updateQuery({ page })}
          />
        </>
      )}
    </div>
  );
};
