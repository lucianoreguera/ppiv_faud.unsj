import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, PanelTop, Square, SquareMinus, User, X } from 'lucide-react';
import { BrandMark, BrandWordmark } from './Brand';
import { useAuth } from '../../context/AuthContext';

/**
 * Layout del Panel de Administración (Figma págs. 7, 8, 9 y 17)
 * Sidebar fijo izquierdo de 240px (#2D2D2D) + contenido sobre crema #FFF9EC.
 * En mobile: top bar de 56px con menú hamburguesa.
 */
const ADMIN_NAV = [
  { to: '/admin', label: 'Panel', icon: Square, end: true },
  { to: '/admin/catalogo', label: 'Documentos', icon: SquareMinus, end: false },
  { to: '/admin/usuarios', label: 'Usuarios', icon: User, end: false },
  { to: '/admin/prestamos', label: 'Préstamos', icon: PanelTop, end: false },
];

const SidebarContent: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <div className="relative h-full flex flex-col">
    {/* Líneas guía verticales (grid de blueprint, Figma pág. 24) */}
    <span aria-hidden="true" className="absolute inset-y-0 left-[26px] w-px bg-faud-amber/[0.07]" />
    <span aria-hidden="true" className="absolute inset-y-0 right-[26px] w-px bg-faud-amber/[0.07]" />

    <Link to="/admin" className="relative flex items-start gap-3 pl-6 pr-4 pt-9 pb-14">
      <BrandMark icon="plus" className="w-6 h-6 mt-0.5" />
      <BrandWordmark
        subtitle="Biblioteca FAUD-UNSJ · Admin"
        titleClassName="text-faud-amber text-[18px]"
        subtitleClassName="text-faud-text-cream text-[11px]"
      />
    </Link>

    <nav aria-label="Navegación de administración" className="relative flex flex-col">
      {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-4 h-12 px-6 border-l-[3px] text-[15px] transition-colors ${
              isActive
                ? 'border-faud-amber bg-faud-amber/[0.15] text-faud-amber font-bold'
                : 'border-transparent text-faud-text-cream hover:bg-white/5'
            }`
          }
        >
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>

    <div className="relative mt-auto">
      <div className="mx-7 border-t border-white/10" />
      <button
        type="button"
        onClick={onLogout}
        className="w-full flex items-center gap-4 h-16 px-6 text-[15px] text-faud-text-cream hover:text-white"
      >
        <LogOut className="w-[18px] h-[18px]" strokeWidth={1.75} />
        Cerrar sesión
      </button>
      {/* Motivo decorativo inferior (líneas de acento) */}
      <svg aria-hidden="true" className="absolute left-7 bottom-0 w-16 h-6" viewBox="0 0 64 24" fill="none">
        <path d="M0 0l24 24M10 0l24 24M20 0l24 24" stroke="#FFB606" strokeOpacity="0.35" />
      </svg>
      <span aria-hidden="true" className="absolute right-7 bottom-2 w-5 h-5 border border-faud-amber/40 p-[3px]">
        <span className="block w-full h-full bg-faud-amber/30" />
      </span>
    </div>
  </div>
);

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-faud-cream text-faud-text lg:flex">
      {/* Sidebar desktop fijo 240px */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-sidebar bg-faud-dark z-30">
        <SidebarContent onLogout={handleLogout} />
      </aside>

      {/* Top bar mobile (Figma pág. 17) */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 h-topbar px-5 bg-faud-dark">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 -ml-1 text-faud-text-cream"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <BrandMark icon="plus" className="w-5 h-5" />
        <span className="text-faud-amber text-[15px] font-bold">Repositorio FAUD</span>
      </header>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 top-topbar z-30 bg-faud-ink/40" onClick={() => setMenuOpen(false)}>
          <aside className="w-sidebar h-full bg-faud-dark" onClick={(e) => e.stopPropagation()}>
            <SidebarContent onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 lg:ml-sidebar px-5 py-4 lg:px-[60px] lg:pt-12 lg:pb-12">
        <Outlet />
      </main>
    </div>
  );
};

/** Encabezado de página del panel admin: H2 + subtítulo + línea divisoria con acento */
export const AdminPageHeader: React.FC<{ title: string; subtitle: string; mobileSubtitle?: string }> = ({
  title,
  subtitle,
  mobileSubtitle,
}) => (
  <header className="mb-5 lg:mb-8">
    <h1 className="text-[20px] lg:text-[32px] font-bold text-faud-ink leading-tight">{title}</h1>
    <p className="text-caption lg:text-[16px] text-faud-muted mt-0.5 lg:mt-1">
      {mobileSubtitle ? (
        <>
          <span className="lg:hidden">{mobileSubtitle}</span>
          <span className="hidden lg:inline">{subtitle}</span>
        </>
      ) : (
        subtitle
      )}
    </p>
    <div className="relative h-px bg-faud-border-warm mt-2 lg:mt-7">
      <span className="absolute left-0 -top-px h-[3px] w-7 lg:w-10 bg-faud-amber" />
    </div>
  </header>
);
