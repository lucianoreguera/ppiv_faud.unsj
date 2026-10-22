import React, { useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { TabPill } from '../../components/ui/Badge';
import { InfoDot } from '../../components/ui/Decorations';
import { useToast } from '../../context/ToastContext';
import {
  ADMIN_USER_COUNTS,
  PENDING_USERS,
  type AdminUserFixture,
  type AdminUserTab,
} from '../../mocks/figma-fixtures';

/** Validación de usuarios (Figma págs. 8 y 17) — Fase 5 lo conecta con GET/PATCH /api/v1/usuarios */
const TABS: { id: AdminUserTab; label: string }[] = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'aprobados', label: 'Aprobados' },
  { id: 'rechazados', label: 'Rechazados' },
];

const Avatar: React.FC<{ initials: string }> = ({ initials }) => (
  <span className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-[#E5E7EB] text-faud-ink text-caption font-bold">
    {initials}
  </span>
);

const approveClass =
  'inline-flex items-center justify-center rounded-[4px] bg-faud-amber hover:bg-faud-gold-hover text-faud-ink font-bold transition-colors';
const rejectClass =
  'inline-flex items-center justify-center rounded-[4px] bg-white border border-faud-border-warm hover:border-status-danger hover:text-status-danger text-faud-muted font-bold transition-colors';

export const AdminUsersPage: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<AdminUserTab>('pendientes');
  const [pending, setPending] = useState<AdminUserFixture[]>(PENDING_USERS);

  const resolve = (user: AdminUserFixture, action: 'aprobada' | 'rechazada') => {
    setPending((prev) => prev.filter((u) => u.id !== user.id));
    showToast({
      title: `Cuenta ${action} (vista de ejemplo)`,
      description: `${user.nombre} · ${user.departamento}. Fase 5: PATCH /api/v1/usuarios/:id/estado.`,
      variant: action === 'aprobada' ? 'success' : 'warning',
    });
  };

  const users = tab === 'pendientes' ? pending : [];

  return (
    <>
      <AdminPageHeader
        title="Usuarios"
        subtitle="Validá las cuentas de usuarios de los departamentos de la provincia."
        mobileSubtitle="Validá las cuentas de la provincia."
      />

      <div role="tablist" className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <TabPill
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`lg:!h-[38px] lg:!px-3.5 ${t.id === 'rechazados' ? 'hidden lg:inline-flex' : ''}`}
          >
            {t.label} ({t.id === 'pendientes' ? pending.length : ADMIN_USER_COUNTS[t.id]})
          </TabPill>
        ))}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden lg:block mt-5 bg-white rounded-card border border-faud-border-warm overflow-hidden">
        <table className="w-full text-left">
          <thead className="table-head">
            <tr className="h-[50px] border-b border-faud-border-warm">
              <th className="pl-7 w-[30%] font-bold">Nombre del usuario</th>
              <th className="w-[26%] font-bold">Correo institucional</th>
              <th className="w-[22%] font-bold">Departamento</th>
              <th className="font-bold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr
                key={user.id}
                className={`h-20 ${index > 0 ? 'border-t border-dashed border-faud-border-warm' : ''}`}
              >
                <td className="pl-7">
                  <div className="flex items-center gap-4 text-body text-faud-ink">
                    <Avatar initials={user.iniciales} />
                    {user.nombre}
                  </div>
                </td>
                <td className="text-body text-faud-muted">{user.email}</td>
                <td className="text-body text-faud-ink">{user.departamento}</td>
                <td>
                  <div className="flex gap-2.5">
                    <button type="button" onClick={() => resolve(user, 'aprobada')} className={`${approveClass} h-9 w-20 text-caption`}>
                      Aprobar
                    </button>
                    <button type="button" onClick={() => resolve(user, 'rechazada')} className={`${rejectClass} h-9 w-20 text-caption`}>
                      Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-body text-faud-muted">
                  {tab === 'pendientes'
                    ? 'No hay cuentas pendientes de validación.'
                    : 'El listado se cargará desde el backend en la Fase 5.'}
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
              <Avatar initials={user.iniciales} />
              <div className="min-w-0">
                <p className="text-body font-bold text-faud-ink">{user.nombre}</p>
                <p className="text-[11px] text-faud-muted truncate">{user.email}</p>
                <span className="mt-1 inline-flex items-center h-5 px-2 rounded-[4px] bg-faud-amber-light text-status-warning text-[10px] font-bold">
                  {user.departamento}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-dashed border-faud-border-warm flex gap-3">
              <button type="button" onClick={() => resolve(user, 'aprobada')} className={`${approveClass} flex-1 h-9 text-caption`}>
                Aprobar
              </button>
              <button type="button" onClick={() => resolve(user, 'rechazada')} className={`${rejectClass} flex-1 h-9 text-caption font-medium`}>
                Rechazar
              </button>
            </div>
          </article>
        ))}
        {users.length === 0 && (
          <p className="bg-white rounded-card border border-faud-border-warm p-6 text-center text-caption text-faud-muted">
            {tab === 'pendientes'
              ? 'No hay cuentas pendientes de validación.'
              : 'El listado se cargará desde el backend en la Fase 5.'}
          </p>
        )}
      </div>

      <p className="hidden lg:flex items-center gap-2 mt-4 text-body text-faud-muted">
        <InfoDot />
        Los usuarios aprobados tendrán acceso inmediato al repositorio digital para solicitar préstamos
        interdepartamentales.
      </p>
    </>
  );
};
