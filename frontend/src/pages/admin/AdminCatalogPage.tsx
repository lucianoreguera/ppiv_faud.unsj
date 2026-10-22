import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePlus2, Pencil, Search, Trash2 } from 'lucide-react';
import { catalogApi } from '../../api/catalog.api';
import { AdminActionModal } from '../../components/admin/AdminActionModal';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Alert } from '../../components/ui/Alert';
import { AvailabilityBadge, TabPill, TIPO_DOCUMENTO_LABEL } from '../../components/ui/Badge';
import { Button, buttonClasses } from '../../components/ui/Button';
import { InfoDot } from '../../components/ui/Decorations';
import { TextField } from '../../components/ui/FormField';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../context/ToastContext';
import { useSearchDraft } from '../../hooks/useSearchDraft';
import { describeApiError } from '../../utils/api-error';
import type { DocumentItemDto, DocumentsListResponseDto } from '../../types/openapi.types';
import {
  parseAdminCatalogParams,
  toAdminCatalogApiParams,
  writeAdminCatalogParams,
  type AdminCatalogQuery,
  type AvailabilityFilter,
} from './admin-params';

/**
 * Gestión del catálogo (Spec FE-05 regla 2 · RF01) — GET /api/v1/documentos (incluye material suspendido)
 * Acciones: alta y edición (`/admin/catalogo/nuevo`, `/admin/catalogo/:id/editar`), alternar disponibilidad
 * con PATCH /api/v1/documentos/:id `{ disponible }` y baja con DELETE /api/v1/documentos/:id.
 */
const AVAILABILITY_TABS: { id: AvailabilityFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'disponibles', label: 'Disponibles' },
  { id: 'suspendidos', label: 'Suspendidos' },
];

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; data: DocumentsListResponseDto }
  | { status: 'error'; message: string };

/** Interruptor de disponibilidad (habilitado / suspendido por Biblioteca) */
const AvailabilitySwitch: React.FC<{ doc: DocumentItemDto; busy: boolean; onToggle: (doc: DocumentItemDto) => void }> = ({
  doc,
  busy,
  onToggle,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={doc.disponible}
    aria-label={`${doc.disponible ? 'Suspender' : 'Habilitar'} préstamos de “${doc.titulo}”`}
    disabled={busy}
    onClick={() => onToggle(doc)}
    className="inline-flex items-center gap-2 disabled:opacity-50"
  >
    <span
      aria-hidden="true"
      className={`relative inline-block w-9 h-5 rounded-full transition-colors ${
        doc.disponible ? 'bg-status-success' : 'bg-status-disabled'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          doc.disponible ? 'translate-x-4' : ''
        }`}
      />
    </span>
    <AvailabilityBadge disponible={doc.disponible} size="xs" />
  </button>
);

const iconButtonClass =
  'inline-flex items-center justify-center w-9 h-9 rounded-[4px] border border-faud-border-warm bg-white text-faud-muted transition-colors';

export const AdminCatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseAdminCatalogParams(searchParams);
  const { showToast } = useToast();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DocumentItemDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const apiKey = JSON.stringify(toAdminCatalogApiParams(query));

  const updateQuery = (patch: Partial<AdminCatalogQuery>, replace = false) =>
    setSearchParams(writeAdminCatalogParams({ ...query, page: 1, ...patch }), { replace });
  const [searchDraft, setSearchDraft] = useSearchDraft(query.q, (q) => updateQuery({ q }, true));

  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    catalogApi
      .list(JSON.parse(apiKey), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        hasDataRef.current = true;
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (hasDataRef.current) {
          showToast({ title: 'No pudimos actualizar el catálogo', description: describeApiError(error), variant: 'error' });
          return;
        }
        setState({ status: 'error', message: describeApiError(error) });
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [apiKey, reloadToken, showToast]);

  const replaceRow = (documento: DocumentItemDto) =>
    setState((prev) =>
      prev.status === 'ready'
        ? { ...prev, data: { ...prev.data, items: prev.data.items.map((d) => (d.id === documento.id ? documento : d)) } }
        : prev,
    );

  const toggleAvailability = async (doc: DocumentItemDto) => {
    setTogglingId(doc.id);
    try {
      const { documento } = await catalogApi.update(doc.id, { disponible: !doc.disponible });
      replaceRow(documento);
      showToast({
        title: documento.disponible ? 'Documento habilitado' : 'Documento suspendido',
        description: documento.disponible
          ? `“${documento.titulo}” vuelve a admitir solicitudes de préstamo.`
          : documento.prestamosActivosCount > 0
            ? `“${documento.titulo}” no admite nuevas solicitudes. Los ${documento.prestamosActivosCount} préstamos activos siguen vigentes hasta su vencimiento o revocación.`
            : `“${documento.titulo}” no admite nuevas solicitudes de préstamo.`,
        variant: documento.disponible ? 'success' : 'warning',
      });
      // Si el filtro activo ya no incluye al documento, se vuelve a consultar la página
      if (query.disponibilidad !== 'todos') setReloadToken((t) => t + 1);
    } catch (error) {
      showToast({ title: 'No se pudo cambiar la disponibilidad', description: describeApiError(error), variant: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    setDeleteError(null);
    try {
      const result = await catalogApi.remove(deleting.id);
      showToast({ title: 'Documento eliminado', description: `“${deleting.titulo}”. ${result.message}`, variant: 'success' });
      setDeleting(null);
      const lastOnPage = state.status === 'ready' && state.data.items.length === 1 && query.page > 1;
      if (lastOnPage) updateQuery({ page: query.page - 1 });
      else setReloadToken((t) => t + 1);
    } catch (error) {
      setDeleteError(describeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const suspendInstead = async () => {
    if (!deleting) return;
    const doc = deleting;
    setDeleting(null);
    await toggleAvailability(doc);
  };

  const data = state.status === 'ready' ? state.data : null;
  const docs = data?.items ?? [];
  const filtered = Boolean(query.q) || query.disponibilidad !== 'todos';

  const rowActions = (doc: DocumentItemDto, layout: 'table' | 'card') => (
    <>
      <Link
        to={`/admin/catalogo/${doc.id}/editar`}
        className={layout === 'table' ? `${iconButtonClass} hover:border-faud-amber hover:text-faud-ink` : buttonClasses('neutral', 'sm', 'flex-1')}
        aria-label={`Editar “${doc.titulo}”`}
        title="Editar metadatos o reemplazar PDF"
      >
        <Pencil className="w-4 h-4" aria-hidden="true" />
        {layout === 'card' && <span>Editar</span>}
      </Link>
      <button
        type="button"
        onClick={() => {
          setDeleteError(null);
          setDeleting(doc);
        }}
        className={layout === 'table' ? `${iconButtonClass} hover:border-status-danger hover:text-status-danger` : buttonClasses('danger', 'sm', 'flex-1')}
        aria-label={`Eliminar “${doc.titulo}”`}
        title="Eliminar documento"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
        {layout === 'card' && <span>Eliminar</span>}
      </button>
    </>
  );

  return (
    <>
      <AdminPageHeader
        title="Documentos"
        subtitle="Catalogá, editá y habilitá el material digital del repositorio."
        mobileSubtitle="Gestioná el catálogo digital."
        actions={
          <Link to="/admin/catalogo/nuevo" className={buttonClasses('primary', 'md', 'rounded-[4px]')}>
            <FilePlus2 className="w-4 h-4" aria-hidden="true" />
            Cargar documento
          </Link>
        }
      />

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div role="tablist" aria-label="Disponibilidad" className="flex gap-2 overflow-x-auto no-scrollbar">
          {AVAILABILITY_TABS.map((t) => (
            <TabPill
              key={t.id}
              active={query.disponibilidad === t.id}
              onClick={() => updateQuery({ disponibilidad: t.id })}
              className="lg:!h-[38px] lg:!px-3.5"
            >
              {t.label}
              {data && query.disponibilidad === t.id && ` (${data.meta.total})`}
            </TabPill>
          ))}
        </div>
        <div className="relative lg:ml-auto lg:w-[380px]">
          <Search className="w-4 h-4 text-faud-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <TextField
            type="search"
            aria-label="Buscar en el catálogo"
            placeholder="Buscar por título, autor o palabra clave"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {state.status === 'loading' && (
        <div role="status" className="mt-5 space-y-3 animate-pulse">
          <span className="sr-only">Cargando catálogo…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-card bg-white border border-faud-border-warm" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-5">
          <Alert variant="danger" title="No pudimos cargar el catálogo">
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
          {/* Desktop: tabla */}
          <div className="hidden lg:block mt-5 bg-white rounded-card border border-faud-border-warm overflow-hidden">
            <table className="w-full text-left table-fixed">
              <thead className="table-head">
                <tr className="h-[50px] border-b border-faud-border-warm">
                  <th className="pl-7 w-[34%] font-bold">Documento</th>
                  <th className="w-[17%] font-bold">Tipo · Año</th>
                  <th className="w-[13%] font-bold">Departamento</th>
                  <th className="w-[10%] font-bold">Préstamos</th>
                  <th className="w-[16%] font-bold">Disponibilidad</th>
                  <th className="font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, index) => (
                  <tr key={doc.id} className={`h-20 ${index > 0 ? 'border-t border-dashed border-faud-border-warm' : ''}`}>
                    <td className="pl-7 pr-4">
                      <Link
                        to={`/documentos/${doc.id}`}
                        className="block text-body font-bold text-faud-ink truncate hover:text-faud-gold-dark"
                        title={doc.titulo}
                      >
                        {doc.titulo}
                      </Link>
                      <p className="text-caption text-faud-muted truncate">{doc.autor}</p>
                    </td>
                    <td className="pr-3 text-body text-faud-text">
                      {TIPO_DOCUMENTO_LABEL[doc.tipo]} · {doc.anio}
                      <p className="text-caption text-faud-muted">{doc.carrera}</p>
                    </td>
                    <td className="pr-3 text-body text-faud-text">{doc.departamentoOrigen?.nombre ?? '—'}</td>
                    <td className="text-body text-faud-text" title={`${doc.prestamosActivosCount} activos · ${doc.totalPrestamosHistoricos} históricos`}>
                      <span className="font-bold">{doc.prestamosActivosCount}</span>
                      <span className="text-faud-muted"> / {doc.totalPrestamosHistoricos}</span>
                    </td>
                    <td>
                      <AvailabilitySwitch doc={doc} busy={togglingId === doc.id} onToggle={toggleAvailability} />
                    </td>
                    <td className="pr-4">
                      <div className="flex gap-2">{rowActions(doc, 'table')}</div>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-body text-faud-muted">
                      {filtered ? 'Ningún documento coincide con los filtros aplicados.' : 'Todavía no hay documentos catalogados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="h-3" />
          </div>

          {/* Mobile: tarjetas */}
          <div className="lg:hidden mt-4 space-y-3">
            {docs.map((doc) => (
              <article key={doc.id} className="bg-white rounded-card border border-faud-border-warm p-3">
                <p className="text-body font-bold text-faud-ink">{doc.titulo}</p>
                <p className="text-caption text-faud-muted">
                  {doc.autor} · {TIPO_DOCUMENTO_LABEL[doc.tipo]} · {doc.anio}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <AvailabilitySwitch doc={doc} busy={togglingId === doc.id} onToggle={toggleAvailability} />
                  <span className="text-[11px] text-faud-muted">
                    {doc.prestamosActivosCount} activos / {doc.totalPrestamosHistoricos}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed border-faud-border-warm flex gap-3">{rowActions(doc, 'card')}</div>
              </article>
            ))}
            {docs.length === 0 && (
              <p className="bg-white rounded-card border border-faud-border-warm p-6 text-center text-caption text-faud-muted">
                {filtered ? 'Ningún documento coincide con los filtros aplicados.' : 'Todavía no hay documentos catalogados.'}
              </p>
            )}
          </div>

          <Pagination
            className="mt-6"
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={(page) => updateQuery({ page })}
          />
        </div>
      )}

      <p className="hidden lg:flex items-center gap-2 mt-4 text-body text-faud-muted">
        <InfoDot />
        Suspender un documento impide nuevas solicitudes; los préstamos activos siguen vigentes hasta su vencimiento.
      </p>

      <AdminActionModal
        open={deleting !== null}
        title="Eliminar documento"
        icon={<Trash2 className="w-6 h-6 text-status-danger" />}
        confirmLabel="Eliminar definitivamente"
        confirmVariant="danger"
        submitting={submitting}
        error={deleteError}
        extraAction={
          deleteError && deleting?.disponible ? (
            <Button variant="secondary" onClick={suspendInstead} disabled={submitting}>
              Suspender en su lugar
            </Button>
          ) : undefined
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        {deleting && (
          <>
            <p className="font-bold text-faud-ink">“{deleting.titulo}”</p>
            <p className="text-faud-muted">
              {deleting.autor} · {TIPO_DOCUMENTO_LABEL[deleting.tipo]} · {deleting.anio}
            </p>
            <p>
              Se quitará la ficha del catálogo y se borrará el archivo PDF del almacenamiento privado. Solo es posible
              si el documento nunca tuvo préstamos; de lo contrario, suspendé su disponibilidad.
            </p>
          </>
        )}
      </AdminActionModal>
    </>
  );
};
