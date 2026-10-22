import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { BrandMark, BrandWordmark } from './Brand';
import { SESSION_USER } from '../../mocks/figma-fixtures';

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

export const UserLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme: NavTheme = location.pathname.startsWith('/mis-prestamos') ? 'dark' : 'light';
  const isDocumentDetail = location.pathname.startsWith('/documentos/');

  useEffect(() => setMenuOpen(false), [location.pathname]);

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
              <span className="inline-flex items-center h-9 px-6 rounded-pill bg-faud-amber-light text-faud-gold-dark text-body font-bold">
                {SESSION_USER.nombre} · {SESSION_USER.departamento}
              </span>
              <Link
                to="/login"
                className="inline-flex items-center gap-3 text-body text-faud-text hover:text-faud-ink"
              >
                <LogOut className="w-4 h-4 text-faud-gold-dark" />
                Cerrar sesión
              </Link>
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
            <div className="flex items-center justify-end pr-6">
              <span
                title={`${SESSION_USER.nombre} · ${SESSION_USER.departamento}`}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-faud-ink border-[1.5px] border-faud-amber text-white text-caption font-bold"
              >
                {SESSION_USER.iniciales}
              </span>
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
            <p className="pb-3 mb-2 border-b border-faud-border-warm text-caption text-faud-muted">
              {SESSION_USER.nombre} · {SESSION_USER.departamento}
            </p>
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
            <Link to="/login" className="flex items-center gap-2 py-2.5 text-body text-faud-text">
              <LogOut className="w-4 h-4 text-faud-gold-dark" />
              Cerrar sesión
            </Link>
          </nav>
        </div>
      )}

      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
};
