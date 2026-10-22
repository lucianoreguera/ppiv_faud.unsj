import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn, LogOut, Menu, X } from 'lucide-react';
import { BrandMark, BrandWordmark } from './Brand';
import { useAuth } from '../../context/AuthContext';
import { buildLoginPath } from '../../routes/auth-redirect';

/**
 * Layout del alumno / usuario departamental (Catálogo, Ficha y Mis préstamos).
 * Barra superior única oscura #2D2D2D (Figma págs. 13 y 19) a ancho completo: la navegación no cambia
 * de color ni de tamaño al pasar del catálogo a "Mis préstamos", y armoniza con la portada y el panel admin.
 */
const NAV_ITEMS = [
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/mis-prestamos', label: 'Mis préstamos' },
];

const isCatalogSection = (pathname: string) =>
  pathname.startsWith('/catalogo') || pathname.startsWith('/documentos');

const getInitials = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** Anillo ámbar solo con teclado (reemplaza el outline negro por defecto del navegador) */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-faud-amber focus-visible:ring-offset-2 focus-visible:ring-offset-faud-dark rounded-[4px]';

export const UserLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDocumentDetail = location.pathname.startsWith('/documentos/');

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const sessionLabel = user ? `${user.nombre} · ${user.departamento.nombre}` : '';
  const loginPath = buildLoginPath(`${location.pathname}${location.search}`);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (to: string) =>
    to === '/catalogo' ? isCatalogSection(location.pathname) : location.pathname.startsWith(to);

  const desktopLinkClass = (to: string) => {
    const active = isActive(to);
    const underline = active
      ? "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[3px] after:bg-faud-amber after:content-['']"
      : '';
    return `relative h-full inline-flex items-center px-1 text-[15px] transition-colors ${FOCUS_RING} ${underline} ${
      active ? 'text-faud-amber font-bold' : 'text-faud-text-cream hover:text-white'
    }`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-faud-cream text-faud-text">
      <header className="sticky top-0 z-40 bg-faud-dark">
        {/* Desktop (Figma pág. 13) */}
        <div className="hidden lg:flex h-navbar items-stretch px-10">
          <Link to="/catalogo" className={`flex items-center gap-4 w-[360px] shrink-0 self-center ${FOCUS_RING}`}>
            <BrandMark icon="block" className="w-8 h-8" />
            <BrandWordmark
              titleClassName="text-faud-text-cream text-[18px]"
              subtitleClassName="text-faud-muted text-caption"
            />
          </Link>
          <nav aria-label="Navegación principal" className="flex items-stretch gap-10">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={desktopLinkClass(item.to)}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-6">
            {user ? (
              <>
                <span className="inline-flex items-center gap-3" title={sessionLabel}>
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-faud-ink border-[1.5px] border-faud-amber text-white text-caption font-bold"
                  >
                    {getInitials(user.nombre)}
                  </span>
                  <span className="hidden xl:inline text-body text-faud-text-cream">{sessionLabel}</span>
                </span>
                <span aria-hidden="true" className="w-px h-6 bg-faud-text-cream/20" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`inline-flex items-center gap-2 text-body text-faud-text-cream hover:text-white ${FOCUS_RING}`}
                >
                  <LogOut className="w-4 h-4 text-faud-amber" />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <Link
                to={loginPath}
                className={`inline-flex items-center gap-2 text-body font-bold text-faud-text-cream hover:text-white ${FOCUS_RING}`}
              >
                <LogIn className="w-4 h-4 text-faud-amber" />
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>

        {/* Mobile (Figma pág. 19) */}
        <div className="lg:hidden flex items-center gap-3 h-topbar px-5">
          {isDocumentDetail ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={`p-1 -ml-1 text-faud-text-cream ${FOCUS_RING}`}
              aria-label="Volver"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <BrandMark icon="block" className="w-7 h-7" />
          )}
          <Link to="/catalogo" className={`text-faud-amber text-[15px] font-bold ${FOCUS_RING}`}>
            Repositorio FAUD
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`ml-auto p-1 -mr-1 text-faud-text-cream ${FOCUS_RING}`}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Menú hamburguesa mobile (Figma pág. 15: sin sidebar — menú hamburguesa) */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-topbar bottom-0 z-30 bg-faud-ink/40" onClick={() => setMenuOpen(false)}>
          <nav
            aria-label="Menú"
            className="bg-faud-dark border-t border-faud-text-cream/10 px-5 py-4 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {user && (
              <p className="pb-3 mb-2 border-b border-faud-text-cream/10 text-caption text-faud-muted">
                {sessionLabel}
              </p>
            )}
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={`block py-2.5 text-body ${
                  isActive(item.to) ? 'text-faud-amber font-bold' : 'text-faud-text-cream'
                }`}
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 py-2.5 text-body text-faud-text-cream"
              >
                <LogOut className="w-4 h-4 text-faud-amber" />
                Cerrar sesión
              </button>
            ) : (
              <Link to={loginPath} className="flex items-center gap-2 py-2.5 text-body font-bold text-faud-text-cream">
                <LogIn className="w-4 h-4 text-faud-amber" />
                Iniciar sesión
              </Link>
            )}
          </nav>
        </div>
      )}

      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
};
