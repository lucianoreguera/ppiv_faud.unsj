import React from 'react';
import { Link, Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buttonClasses } from '../components/ui/Button';
import { buildLoginPath, getHomePathForRole, resolvePostLoginPath } from './auth-redirect';
import type { RolUsuario } from '../types/openapi.types';

/** Pantalla de espera mientras se revalida la sesión con GET /api/v1/auth/profile */
const SessionLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-faud-cream" role="status">
    <span
      className="inline-block w-8 h-8 border-[3px] border-faud-amber border-t-transparent rounded-full animate-spin"
      aria-hidden="true"
    />
    <span className="sr-only">Verificando sesión…</span>
  </div>
);

/**
 * Rutas privadas: sin sesión redirige a /login preservando el destino en `?redirect=`.
 */
export const ProtectedRoute: React.FC = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <SessionLoading />;
  if (status === 'anonymous') {
    return <Navigate to={buildLoginPath(`${location.pathname}${location.search}`)} replace />;
  }
  return <Outlet />;
};

/**
 * Restricción por rol (se usa dentro de ProtectedRoute). Un rol no autorizado ve la pantalla
 * de acceso restringido en lugar de la ruta solicitada.
 */
export const RoleGuard: React.FC<{ roles: readonly RolUsuario[] }> = ({ roles }) => {
  const { user } = useAuth();

  if (!user) return null;
  if (!roles.includes(user.rol)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-faud-cream px-5">
        <section className="max-w-md w-full bg-white rounded-card border border-faud-border-warm shadow-card p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto text-status-danger" strokeWidth={1.75} />
          <h1 className="mt-4 text-h3 text-faud-ink">Acceso restringido</h1>
          <p className="mt-2 text-body text-faud-muted">
            Esta sección es exclusiva del personal de Biblioteca FAUD-UNSJ.
          </p>
          <Link to={getHomePathForRole(user.rol)} className={buttonClasses('primary', 'md', 'mt-6')}>
            Volver al inicio
          </Link>
        </section>
      </div>
    );
  }
  return <Outlet />;
};

/**
 * Rutas solo para visitantes (/login, /registro): con sesión activa redirige al destino
 * indicado en `?redirect=` o a la pantalla de inicio del rol.
 */
export const GuestRoute: React.FC = () => {
  const { status, user } = useAuth();
  const [searchParams] = useSearchParams();

  if (status === 'loading') return <SessionLoading />;
  if (status === 'authenticated' && user) {
    return <Navigate to={resolvePostLoginPath(user.rol, searchParams.get('redirect'))} replace />;
  }
  return <Outlet />;
};
