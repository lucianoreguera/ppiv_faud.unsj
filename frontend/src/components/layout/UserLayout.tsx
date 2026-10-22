import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn, LogOut, Menu, X } from 'lucide-react';
import { BrandMark, BrandWordmark } from './Brand';
import { useAuth } from '../../context/AuthContext';
import { buildLoginPath } from '../../routes/auth-redirect';

/**
 * Layout del alumno / usuario departamental.
 * - Barra clara (Catálogo y Ficha, Figma págs. 11, 12 y 19): fondo blanco con línea inferior ámbar.
 * - Barra oscura (Mis préstamos, Figma págs. 13 y 19): fondo #2D2D2D.
 */
type NavTheme = 'light' | 'dark';

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

export const UserLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme: NavTheme = location.pathname.startsWith('/mis-prestamos') ? 'dark' : 'light';
  const isDocumentDetail = location.pathname.startsWith('/documentos/');

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const sessionLabel = user ? `${user.nombre} · ${user.departamento.nombre}` : '';
  const loginPath = buildLoginPath(`${location.pathname}${location.search}`);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const desktopLinkClass = (to: string) => {
    const active = to === '/catalogo' ? isCatalogSection(location.pathname) : location.pathname.startsWith(to);
    const base = 'relative h-full inline-flex items-center px-1 text-[15px] transition-colors';
    const underline = active
      ? "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[3px] after:bg-faud-amber after:content-['']"
      : '';
    if (theme === 'dark') {
      return `${base} ${underline} ${active ? 'text-faud-amber font-bold' : 'text-faud-text-cream hover:text-white'}`;
    }
    return `${base} ${underline} ${active ? 'text-faud-ink font-bold' : 'text-faud-muted hover:text-faud-text'}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-faud-cream text-faud-text">
      {theme === 'light' ? (
        <header className="sticky top-0 z-40 bg-white border-b-2 border-faud-amber">
          {/* Desktop (Figma págs. 11 y 12) */}
          <div className="hidden lg:flex h-navbar items-stretch px-10">
            <Link to="/catalogo" className="flex items-center w-[360px] shrink-0">
              <BrandWordmark />
            </Link>
            <nav aria-label="Navegación principal" className="flex items-stretch gap-10">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={desktopLinkClass(item.to)}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-10">
              {user ? (
                <>
                  <span className="inline-flex items-center h-9 px-6 rounded-pill bg-faud-amber-light text-faud-gold-dark text-body font-bold">
                    {sessionLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-3 text-body text-faud-text hover:text-faud-ink"
                  >
                    <LogOut className="w-4 h-4 text-faud-gold-dark" />
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <Link
                  to={loginPath}
                  className="inline-flex items-center gap-3 text-body font-bold text-faud-text hover:text-faud-ink"
                >
                  <LogIn className="w-4 h-4 text-faud-gold-dark" />
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
                className="p-1 -ml-1 text-faud-text"
                aria-label="Volver"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1 -ml-1 text-faud-text"
                aria-label="Abrir menú"
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            )}
            <Link to="/catalogo" className="text-faud-amber text-[15px] font-bold">
              Repositorio FAUD
            </Link>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-40 bg-faud-dark">
          {/* Desktop (Figma pág. 13) */}
          <div className="hidden lg:grid grid-cols-[1fr_auto_1fr] items-stretch h-navbar max-w-[1240px] mx-auto px-0">
            <Link to="/catalogo" className="flex items-center gap-4">
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
            <div className="flex items-center justify-end gap-6 pr-6">
              {user && (
                <>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 text-body text-faud-text-cream hover:text-white"
                  >
                    <LogOut className="w-4 h-4 text-faud-amber" />
                    Cerrar sesión
                  </button>
                  <span
                    title={sessionLabel}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-faud-ink border-[1.5px] border-faud-amber text-white text-caption font-bold"
                  >
                    {getInitials(user.nombre)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Mobile (Figma pág. 19) */}
          <div className="lg:hidden flex items-center justify-between h-topbar px-5">
            <Link to="/catalogo" aria-label="Repositorio FAUD">
              <BrandMark icon="block" className="w-7 h-7" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 -mr-1 text-faud-text-cream"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>
      )}

      {/* Menú hamburguesa mobile (Figma pág. 15: sin sidebar — menú hamburguesa) */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-topbar bottom-0 z-30 bg-faud-ink/40" onClick={() => setMenuOpen(false)}>
          <nav
            aria-label="Menú"
            className="bg-white border-b border-faud-border-warm px-5 py-4 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {user && (
              <p className="pb-3 mb-2 border-b border-faud-border-warm text-caption text-faud-muted">
                {sessionLabel}
              </p>
            )}
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block py-2.5 text-body ${isActive ? 'text-faud-ink font-bold' : 'text-faud-muted'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 py-2.5 text-body text-faud-text"
              >
                <LogOut className="w-4 h-4 text-faud-gold-dark" />
                Cerrar sesión
              </button>
            ) : (
              <Link to={loginPath} className="flex items-center gap-2 py-2.5 text-body font-bold text-faud-text">
                <LogIn className="w-4 h-4 text-faud-gold-dark" />
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
