import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, UserCheck, UserX, Users } from 'lucide-react';
import { usersApi } from '../../api/users.api';
import { AdminActionModal } from '../../components/admin/AdminActionModal';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Alert } from '../../components/ui/Alert';
import { TabPill, UserStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { InfoDot } from '../../components/ui/Decorations';
import { SelectField, TextField } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAdminPanel } from '../../hooks/useAdminIndicators';
import { useDepartmentOptions } from '../../hooks/useDepartmentOptions';
import { useSearchDraft } from '../../hooks/useSearchDraft';
import { describeApiError } from '../../utils/api-error';
import { formatDate } from '../../utils/loan-time';
import type { RolUsuario, UserAdminItemDto, UsersListResponseDto } from '../../types/openapi.types';
import {
  parseUsersParams,
  toUsersApiParams,
  writeUsersParams,
  type UsersQuery,
  type UsersTab,
} from './admin-params';

/**
 * Validación de usuarios por departamento (Figma págs. 8 y 17 · Spec FE-05 regla 1 · RF05)
 * GET /api/v1/usuarios con pestañas y contadores · PATCH /api/v1/usuarios/:id/estado (Aprobar / Rechazar con motivo).
 * Filtros en la URL: `?estado=todos|aprobados|rechazados&departamento=<uuid>&rol=<Rol>&q=<texto>`.
 */
const TABS: { id: UsersTab; label: string; count: (c: UsersListResponseDto['contadores']) => number }[] = [
  { id: 'todos', label: 'Todos', count: (c) => c.todos },
  { id: 'pendientes', label: 'Pendientes', count: (c) => c.pendientes },
  { id: 'aprobados', label: 'Aprobados', count: (c) => c.aprobados },
  { id: 'rechazados', label: 'Rechazados', count: (c) => c.rechazados },
];

const EMPTY_TEXT: Record<UsersTab, string> = {
  todos: 'No hay usuarios registrados con estos filtros.',
  pendientes: 'No hay cuentas pendientes de validación.',
  aprobados: 'No hay cuentas aprobadas con estos filtros.',
  rechazados: 'No hay solicitudes rechazadas con estos filtros.',
};

const ROL_OPTIONS: { value: RolUsuario; label: string }[] = [
  { value: 'USUARIO', label: 'Usuario departamental' },
  { value: 'ADMINISTRADOR', label: 'Administrador' },
];

type Decision = 'APROBADO' | 'RECHAZADO';

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; data: UsersListResponseDto }
  | { status: 'error'; message: string };

export const initialsOf = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

const Avatar: React.FC<{ nombre: string }> = ({ nombre }) => (
  <span
    aria-hidden="true"
    className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-[#E5E7EB] text-faud-ink text-caption font-bold"
  >
    {initialsOf(nombre)}
  </span>
);

const approveClass =
  'inline-flex items-center justify-center rounded-[4px] bg-faud-amber hover:bg-faud-gold-hover text-faud-ink font-bold transition-colors disabled:opacity-50';
const rejectClass =
  'inline-flex items-center justify-center rounded-[4px] bg-white border border-faud-border-warm hover:border-status-danger hover:text-status-danger text-faud-muted font-bold transition-colors disabled:opacity-50';

const UserActions: React.FC<{
  user: UserAdminItemDto;
  isSelf: boolean;
  onDecide: (user: UserAdminItemDto, decision: Decision) => void;
  layout: 'table' | 'card';
}> = ({ user, isSelf, onDecide, layout }) => {
  const size = layout === 'table' ? 'h-9 w-20 text-caption' : 'flex-1 h-9 text-caption';
  const canApprove = user.estadoValidacion !== 'APROBADO';
  const canReject = user.estadoValidacion !== 'RECHAZADO' && !isSelf;
  if (!canApprove && !canReject) {
    return <span className="text-caption text-faud-muted">{isSelf ? 'Tu cuenta' : '—'}</span>;
  }
  return (
    <>
      {canApprove && (
        <button
          type="button"
          onClick={() => onDecide(user, 'APROBADO')}
          className={`${approveClass} ${size}`}
          aria-label={`Aprobar a ${user.nombre}`}
        >
          Aprobar
        </button>
      )}
      {canReject && (
        <button
          type="button"
          onClick={() => onDecide(user, 'RECHAZADO')}
          className={`${rejectClass} ${size}`}
          aria-label={`Rechazar a ${user.nombre}`}
        >
          Rechazar
        </button>
      )}
    </>
  );
};

export const AdminUsersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseUsersParams(searchParams);
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { refreshIndicators } = useAdminPanel();
  const departments = useDepartmentOptions();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [pending, setPending] = useState<{ user: UserAdminItemDto; decision: Decision } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const apiKey = JSON.stringify(toUsersApiParams(query));

  const updateQuery = (patch: Partial<UsersQuery>, replace = false) =>
    setSearchParams(writeUsersParams({ ...query, ...patch }), { replace });
  const [searchDraft, setSearchDraft] = useSearchDraft(query.q, (q) => updateQuery({ q }, true));

  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    usersApi
      .list(JSON.parse(apiKey), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        hasDataRef.current = true;
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (hasDataRef.current) {
          showToast({ title: 'No pudimos actualizar el listado', description: describeApiError(error), variant: 'error' });
          return;
        }
        setState({ status: 'error', message: describeApiError(error) });
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [apiKey, reloadToken, showToast]);

  const openDecision = (user: UserAdminItemDto, decision: Decision) => {
    setActionError(null);
    setPending({ user, decision });
  };

  const confirmDecision = async (motivo?: string) => {
    if (!pending) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await usersApi.updateStatus(pending.user.id, { estado: pending.decision, motivo });
      showToast({
        title: pending.decision === 'APROBADO' ? 'Cuenta aprobada' : 'Cuenta rechazada',
        description:
          pending.decision === 'APROBADO'
            ? `${result.message} Se envió el correo de confirmación a ${result.usuario.email}.`
            : result.message,
        variant: pending.decision === 'APROBADO' ? 'success' : 'warning',
      });
      setPending(null);
      setReloadToken((t) => t + 1);
      refreshIndicators();
    } catch (error) {
      setActionError(describeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const data = state.status === 'ready' ? state.data : null;
  const users = data?.items ?? [];
  const filtered = Boolean(query.departamentoId || query.rol || query.q);
  const emptyText = filtered ? 'Ningún usuario coincide con los filtros aplicados.' : EMPTY_TEXT[query.tab];
  const isSelf = (u: UserAdminItemDto) => u.id === currentUser?.id;

  return (
    <>
      <AdminPageHeader
        title="Usuarios"
        subtitle="Validá las cuentas de usuarios de los departamentos de la provincia."
        mobileSubtitle="Validá las cuentas de la provincia."
      />

      <div role="tablist" aria-label="Estado de validación" className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <TabPill
            key={t.id}
            active={query.tab === t.id}
            onClick={() => updateQuery({ tab: t.id })}
            className="lg:!h-[38px] lg:!px-3.5"
          >
            {t.label}
            {data && ` (${t.count(data.contadores)})`}
          </TabPill>
        ))}
      </div>

      {/* Filtros combinados: departamento, rol y búsqueda */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_240px_220px] gap-3">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="w-4 h-4 text-faud-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <TextField
            type="search"
            aria-label="Buscar por nombre o correo"
            placeholder="Buscar por nombre o correo"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="pl-10"
          />
        </div>
        <SelectField
          aria-label="Departamento"
          placeholder={departments.status === 'loading' ? 'Cargando departamentos…' : 'Todos los departamentos'}
          options={departments.options}
          value={query.departamentoId ?? ''}
          onChange={(e) => updateQuery({ departamentoId: e.target.value || undefined })}
        />
        <SelectField
          aria-label="Rol"
          placeholder="Todos los roles"
          options={ROL_OPTIONS}
          value={query.rol ?? ''}
          onChange={(e) => updateQuery({ rol: (e.target.value || undefined) as RolUsuario | undefined })}
        />
      </div>

      {state.status === 'loading' && (
        <div role="status" className="mt-5 space-y-3 animate-pulse">
          <span className="sr-only">Cargando usuarios…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-card bg-white border border-faud-border-warm" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-5">
          <Alert variant="danger" title="No pudimos cargar los usuarios">
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

      {data && (
        <div aria-busy={refreshing} className={refreshing ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <p className="sr-only" aria-live="polite">
            {data.total === 1 ? '1 usuario' : `${data.total} usuarios`}
          </p>

          {/* Desktop: tabla */}
          <div className="hidden lg:block mt-5 bg-white rounded-card border border-faud-border-warm overflow-hidden">
            <table className="w-full text-left">
              <thead className="table-head">
                <tr className="h-[50px] border-b border-faud-border-warm">
                  <th className="pl-7 w-[28%] font-bold">Nombre del usuario</th>
                  <th className="w-[26%] font-bold">Correo institucional</th>
                  <th className="w-[16%] font-bold">Departamento</th>
                  <th className="w-[13%] font-bold">Estado</th>
                  <th className="font-bold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`h-20 ${index > 0 ? 'border-t border-dashed border-faud-border-warm' : ''}`}
                  >
                    <td className="pl-7 pr-3">
                      <div className="flex items-center gap-4 text-body text-faud-ink">
                        <Avatar nombre={user.nombre} />
                        <div className="min-w-0">
                          <p className="truncate">{user.nombre}</p>
                          <p className="text-caption text-faud-muted">
                            {user.rol === 'ADMINISTRADOR' ? 'Administrador · ' : ''}Alta {formatDate(user.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="pr-3 text-body text-faud-muted break-all">{user.email}</td>
                    <td className="text-body text-faud-ink">{user.departamento.nombre}</td>
                    <td>
                      <UserStatusBadge estado={user.estadoValidacion} />
                    </td>
                    <td className="pr-4">
                      <div className="flex gap-2.5">
                        <UserActions user={user} isSelf={isSelf(user)} onDecide={openDecision} layout="table" />
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-body text-faud-muted">
                      {emptyText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="h-3" />
          </div>

          {/* Mobile: tarjetas */}
          <div className="lg:hidden mt-5 space-y-3">
            {users.map((user) => (
              <article key={user.id} className="bg-white rounded-card border border-faud-border-warm p-3">
                <div className="flex gap-3">
                  <Avatar nombre={user.nombre} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-body font-bold text-faud-ink">{user.nombre}</p>
                      <UserStatusBadge estado={user.estadoValidacion} />
                    </div>
                    <p className="text-[11px] text-faud-muted truncate">{user.email}</p>
                    <span className="mt-1 inline-flex items-center h-5 px-2 rounded-[4px] bg-faud-amber-light text-status-warning text-[10px] font-bold">
                      {user.departamento.nombre}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed border-faud-border-warm flex gap-3">
                  <UserActions user={user} isSelf={isSelf(user)} onDecide={openDecision} layout="card" />
                </div>
              </article>
            ))}
            {users.length === 0 && (
              <p className="bg-white rounded-card border border-faud-border-warm p-6 text-center text-caption text-faud-muted">
                {emptyText}
              </p>
            )}
          </div>

          {users.length === 0 && filtered && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setSearchParams(writeUsersParams({ tab: query.tab }))}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      <p className="hidden lg:flex items-center gap-2 mt-4 text-body text-faud-muted">
        <InfoDot />
        Los usuarios aprobados tendrán acceso inmediato al repositorio digital para solicitar préstamos
        interdepartamentales.
      </p>

      <AdminActionModal
        open={pending !== null}
        title={pending?.decision === 'APROBADO' ? 'Aprobar cuenta' : 'Rechazar cuenta'}
        icon={
          pending?.decision === 'APROBADO' ? (
            <UserCheck className="w-6 h-6 text-status-success" />
          ) : (
            <UserX className="w-6 h-6 text-status-danger" />
          )
        }
        confirmLabel={pending?.decision === 'APROBADO' ? 'Aprobar cuenta' : 'Rechazar cuenta'}
        confirmVariant={pending?.decision === 'APROBADO' ? 'primary' : 'danger'}
        motivo="optional"
        motivoPlaceholder={
          pending?.decision === 'APROBADO'
            ? 'Ej: Pertenencia departamental verificada.'
            : 'Ej: El correo no corresponde a un organismo del departamento.'
        }
        submitting={submitting}
        error={actionError}
        onConfirm={confirmDecision}
        onClose={() => setPending(null)}
      >
        {pending && (
          <>
            <p className="flex items-center gap-2 font-bold text-faud-ink">
              <Users className="w-4 h-4 text-faud-gold-dark" aria-hidden="true" />
              {pending.user.nombre} · {pending.user.departamento.nombre}
            </p>
            <p className="text-faud-muted break-all">{pending.user.email}</p>
            <p>
              {pending.decision === 'APROBADO'
                ? 'La cuenta quedará habilitada para solicitar préstamos digitales y se le enviará un correo de confirmación.'
                : pending.user.estadoValidacion === 'APROBADO'
                  ? 'La cuenta perderá el acceso al repositorio: no podrá iniciar sesión ni solicitar nuevos préstamos.'
                  : 'La solicitud de registro quedará rechazada y el usuario no podrá iniciar sesión.'}
            </p>
          </>
        )}
      </AdminActionModal>
    </>
  );
};
