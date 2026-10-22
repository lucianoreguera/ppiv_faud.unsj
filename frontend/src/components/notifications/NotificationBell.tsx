import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { useToast } from '../../context/ToastContext';
import { formatRelative } from '../../utils/loan-time';
import { NOTIFICATION_META, notificationText } from './notification-meta';
import type { NotificationItemDto } from '../../types/openapi.types';

/**
 * Campana de notificaciones de la barra superior (Spec FE-03, regla 4 · RF06).
 * Badge con `contadores.noLeidas`, panel con los últimos avisos, "Marcar todas como leídas" y acceso a /notificaciones.
 * Al abrir un aviso se marca como leído y se navega a la sección relacionada de "Mis préstamos".
 */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-faud-amber focus-visible:ring-offset-2 focus-visible:ring-offset-faud-dark rounded-[4px]';

export const unreadBadgeLabel = (count: number) => (count > 99 ? '99+' : String(count));

export const NotificationBell: React.FC<{ placement?: 'desktop' | 'mobile' }> = ({ placement = 'desktop' }) => {
  const { counters, latest, markRead, markAllRead } = useNotifications();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const unread = counters?.noLeidas ?? 0;

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const openNotification = (n: NotificationItemDto) => {
    if (!n.leida) void markRead(n.id).catch(() => undefined);
    navigate(NOTIFICATION_META[n.tipo].to);
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
    } catch {
      showToast({ title: 'No pudimos marcar las notificaciones', description: 'Intentá nuevamente.', variant: 'error' });
    } finally {
      setMarkingAll(false);
    }
  };

  const label = unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones';

  return (
    <div ref={containerRef} className={placement === 'desktop' ? 'relative' : ''}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        className={`relative p-1.5 text-faud-text-cream hover:text-white ${FOCUS_RING}`}
      >
        <Bell className="w-[22px] h-[22px]" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-faud-amber text-faud-ink text-[10px] font-bold ring-2 ring-faud-dark"
          >
            {unreadBadgeLabel(unread)}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Últimas notificaciones"
          className={`z-50 bg-white rounded-card border border-faud-border-warm shadow-auth overflow-hidden ${
            placement === 'desktop' ? 'absolute right-0 top-full mt-3 w-[380px]' : 'fixed inset-x-3 top-[64px]'
          }`}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-faud-border-warm">
            <p className="flex-1 text-[15px] font-bold text-faud-ink">
              Notificaciones
              {unread > 0 && <span className="ml-1.5 text-caption font-bold text-status-warning">{unread} sin leer</span>}
            </p>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unread === 0 || markingAll}
              className="inline-flex items-center gap-1 text-caption font-bold text-faud-gold-dark hover:text-faud-ink disabled:text-status-disabled disabled:cursor-not-allowed"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como leídas
            </button>
          </div>

          {latest.length === 0 ? (
            <p className="px-4 py-8 text-center text-body text-faud-muted">
              {counters ? 'No tenés notificaciones por ahora.' : 'Cargando notificaciones…'}
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-faud-border-warm">
              {latest.map((n) => {
                const meta = NOTIFICATION_META[n.tipo];
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-faud-cream focus-visible:outline-none focus-visible:bg-faud-cream ${
                        n.leida ? '' : 'bg-faud-amber-light/40'
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-full ${meta.tone}`}>
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`text-body text-faud-ink ${n.leida ? 'font-medium' : 'font-bold'}`}>{meta.label}</span>
                          {!n.leida && (
                            <span className="w-2 h-2 rounded-full bg-faud-amber" aria-label="No leída" role="img" />
                          )}
                        </span>
                        <span className="block text-caption text-faud-text line-clamp-2">{notificationText(n)}</span>
                        <span className="block mt-0.5 text-[11px] text-faud-muted" title={new Date(n.fechaEnvio).toLocaleString('es-AR')}>
                          {n.prestamo.codigoFormateado} · {formatRelative(n.fechaEnvio)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to="/notificaciones"
            className="block px-4 py-3 text-center text-body font-bold text-faud-gold-dark border-t border-faud-border-warm hover:bg-faud-cream"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
};
