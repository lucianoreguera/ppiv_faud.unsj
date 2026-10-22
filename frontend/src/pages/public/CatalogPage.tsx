import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { catalogApi } from '../../api/catalog.api';
import { ApiHttpError } from '../../api/http-client';
import { CatalogFiltersPanel, type YearDraft } from '../../components/catalog/CatalogFilters';
import { DocumentCard, DocumentCardSkeleton } from '../../components/catalog/DocumentCard';
import { TerritorialBanner } from '../../components/catalog/TerritorialBanner';
import { Alert } from '../../components/ui/Alert';
import { TIPO_DOCUMENTO_LABEL } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useTerritorialMetrics } from '../../hooks/useTerritorialMetrics';
import { TIPOS_DOCUMENTO, type DocumentsListResponseDto, type TipoDocumento } from '../../types/openapi.types';
import {
  countActiveFilters,
  parseCatalogParams,
  SEARCH_DEBOUNCE_MS,
  serializeCatalogParams,
  toCatalogApiParams,
  validateYearRange,
  type CatalogFilters,
} from './catalog-params';

interface ResultsState {
  status: 'loading' | 'ready' | 'error';
  data: DocumentsListResponseDto | null;
  errorMessage?: string;
}

const yearDraftFrom = (filters: CatalogFilters): YearDraft => ({
  desde: filters.anioDesde?.toString() ?? '',
  hasta: filters.anioHasta?.toString() ?? '',
});

const describeCatalogError = (error: unknown) =>
  error instanceof ApiHttpError && error.code === 'NETWORK_ERROR'
    ? 'No pudimos comunicarnos con el Repositorio FAUD. Verificá tu conexión e intentá nuevamente.'
    : error instanceof Error
      ? error.message
      : 'Intentá nuevamente en unos instantes.';

/**
 * Catálogo público interdepartamental (Figma págs. 11 y 19 · Spec FE-02 · RF02)
 * GET /api/v1/documentos con filtros combinables sincronizados en la URL y
 * GET /api/v1/departamentos/metricas para el banner territorial y el filtro de departamentos.
 */
export const CatalogPage: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseCatalogParams(searchParams), [searchParams]);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  // setSearchParams cambia de identidad con cada URL: el ref mantiene estable a applyFilters
  // para que los efectos de debounce no reapliquen valores viejos al navegar atrás o limpiar filtros.
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const metrics = useTerritorialMetrics();

  /** Cualquier cambio de filtro vuelve a la página 1, salvo que el parche indique otra */
  const applyFilters = useCallback(
    (patch: Partial<CatalogFilters>, options: { replace?: boolean } = {}) => {
      const next: CatalogFilters = { ...filtersRef.current, page: undefined, ...patch };
      setSearchParamsRef.current(serializeCatalogParams(next), { replace: options.replace });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Búsqueda libre con debounce (q)
  // ---------------------------------------------------------------------------
  const [queryDraft, setQueryDraft] = useState(filters.q ?? '');
  const debouncedQuery = useDebouncedValue(queryDraft, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const q = debouncedQuery.trim() || undefined;
    if (q !== filtersRef.current.q) applyFilters({ q }, { replace: true });
  }, [debouncedQuery, applyFilters]);

  // URL → borrador (atrás/adelante del navegador o "Limpiar filtros")
  useEffect(() => {
    setQueryDraft((draft) => (draft.trim() === (filters.q ?? '') ? draft : (filters.q ?? '')));
  }, [filters.q]);

  // ---------------------------------------------------------------------------
  // Rango de años con validación previa (evita el 400 de anioDesde > anioHasta)
  // ---------------------------------------------------------------------------
  const [yearDraft, setYearDraft] = useState<YearDraft>(() => yearDraftFrom(filters));
  const debouncedYearDraft = useDebouncedValue(yearDraft, SEARCH_DEBOUNCE_MS);
  const [yearError, setYearError] = useState<string>();

  const commitYears = useCallback(
    (draft: YearDraft) => {
      const range = validateYearRange(draft.desde, draft.hasta);
      setYearError(range.error);
      if (range.error) return;
      const current = filtersRef.current;
      if (range.anioDesde !== current.anioDesde || range.anioHasta !== current.anioHasta) {
        applyFilters({ anioDesde: range.anioDesde, anioHasta: range.anioHasta }, { replace: true });
      }
    },
    [applyFilters],
  );

  useEffect(() => {
    commitYears(debouncedYearDraft);
  }, [debouncedYearDraft, commitYears]);

  useEffect(() => {
    setYearDraft((draft) => {
      const range = validateYearRange(draft.desde, draft.hasta);
      const inSync = !range.error && range.anioDesde === filters.anioDesde && range.anioHasta === filters.anioHasta;
      return inSync ? draft : yearDraftFrom(filtersRef.current);
    });
  }, [filters.anioDesde, filters.anioHasta]);

  // ---------------------------------------------------------------------------
  // GET /api/v1/documentos
  // ---------------------------------------------------------------------------
  const apiParams = useMemo(() => toCatalogApiParams(filters), [filters]);
  const requestKey = JSON.stringify(apiParams);
  const [results, setResults] = useState<ResultsState>({ status: 'loading', data: null });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResults((prev) => ({ ...prev, status: 'loading' }));
    catalogApi
      .list(apiParams, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResults({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResults((prev) => ({ status: 'error', data: prev.data, errorMessage: describeCatalogError(error) }));
      });
    return () => controller.abort();
    // requestKey resume apiParams: evita repetir la consulta con filtros equivalentes
  }, [requestKey, reloadToken]);

  const departmentOptions = useMemo(
    () =>
      (metrics.data?.departamentos ?? []).map((d) => ({
        value: d.id,
        label: d.totalDocumentos > 0 ? `${d.nombre} (${d.totalDocumentos})` : d.nombre,
      })),
    [metrics.data],
  );

  const activeCount = countActiveFilters(filters);
  const clearFilters = () => {
    setQueryDraft('');
    setYearDraft({ desde: '', hasta: '' });
    setYearError(undefined);
    setSearchParams(new URLSearchParams());
  };

  const changePage = (page: number) => {
    applyFilters({ page });
    document.getElementById('catalogo-resultados')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = queryDraft.trim() || undefined;
    if (q !== filters.q) applyFilters({ q });
  };

  const data = results.data;
  const isInitialLoad = results.status === 'loading' && !data;
  const isRefreshing = results.status === 'loading' && !!data;

  return (
    <div className="px-5 lg:px-10 pt-4 lg:pt-7 pb-12">
      <header>
        <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-ink leading-tight">
          <span className="lg:hidden">Catálogo</span>
          <span className="hidden lg:inline">Catálogo de documentos</span>
        </h1>
        <p className="hidden lg:block text-[16px] text-faud-muted mt-0.5">
          Explora y solicita préstamos digitales de tesis, monografías e investigaciones de todos los
          departamentos.
        </p>
      </header>

      {metrics.data && <TerritorialBanner metrics={metrics.data} className="mt-4 lg:mt-6 lg:max-w-[1160px]" />}

      <form role="search" onSubmit={handleSearchSubmit} className="mt-4 lg:mt-6 flex gap-5 lg:max-w-[1160px]">
        <div className="relative flex-1">
          <Search className="w-5 h-5 lg:w-6 lg:h-6 text-faud-muted absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder={isMobile ? 'Buscar documentos...' : 'Buscar por título, autor, director o palabra clave...'}
            aria-label="Buscar documentos"
            className="field-input h-11 lg:h-14 pl-10 lg:pl-12 text-body lg:text-[16px]"
          />
        </div>
        <button
          type="submit"
          className="hidden lg:inline-flex items-center justify-center h-14 w-[120px] rounded-input bg-faud-amber hover:bg-faud-gold-hover text-white text-[16px] font-bold"
        >
          Buscar
        </button>
      </form>

      {/* Filtros rápidos mobile por tipo + acceso al panel completo (Figma pág. 19) */}
      <div className="lg:hidden mt-4 flex items-center gap-2">
        <div className="flex-1 min-w-0 -ml-5 pl-5 flex gap-2 overflow-x-auto no-scrollbar">
          {([undefined, ...TIPOS_DOCUMENTO] as (TipoDocumento | undefined)[]).map((tipo) => {
            const active = filters.tipo === tipo;
            return (
              <button
                key={tipo ?? 'todos'}
                type="button"
                aria-pressed={active}
                onClick={() => applyFilters({ tipo })}
                className={`shrink-0 h-8 px-3.5 rounded-pill text-caption border ${
                  active
                    ? 'bg-faud-ink border-faud-ink text-white font-bold'
                    : 'bg-white border-faud-border-warm text-faud-text'
                }`}
              >
                {tipo ? TIPO_DOCUMENTO_LABEL[tipo] : 'Todos'}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((open) => !open)}
          aria-expanded={mobileFiltersOpen}
          aria-controls="catalogo-filtros"
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-faud-amber bg-white text-caption font-bold text-faud-gold-dark"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      <div className="mt-5 lg:mt-6 flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
        <CatalogFiltersPanel
          id="catalogo-filtros"
          className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}
          filters={filters}
          departmentOptions={departmentOptions}
          departmentsLoading={metrics.status === 'loading'}
          yearDraft={yearDraft}
          yearError={yearError}
          activeCount={activeCount}
          onChange={(patch) => applyFilters(patch)}
          onYearDraftChange={(draft) => {
            setYearDraft(draft);
            setYearError(undefined);
          }}
          onYearCommit={() => commitYears(yearDraft)}
          onClear={clearFilters}
        />

        <section
          id="catalogo-resultados"
          aria-label="Resultados del catálogo"
          aria-busy={results.status === 'loading'}
          className="flex-1 min-w-0 w-full scroll-mt-24"
        >
          {data && (
            <p role="status" className="mb-3 lg:mb-4 text-caption lg:text-body text-faud-muted">
              <strong className="text-faud-ink">{data.meta.total}</strong>{' '}
              {data.meta.total === 1 ? 'documento encontrado' : 'documentos encontrados'}
              {data.meta.totalPages > 1 && ` · Página ${data.meta.page} de ${data.meta.totalPages}`}
            </p>
          )}

          {results.status === 'error' && (
            <Alert variant="danger" title="No pudimos cargar el catálogo" className="mb-4">
              <p>{results.errorMessage}</p>
              <button
                type="button"
                onClick={() => setReloadToken((t) => t + 1)}
                className="mt-1 font-bold underline"
              >
                Reintentar
              </button>
            </Alert>
          )}

          {isInitialLoad && (
            <div className="space-y-3 lg:space-y-5">
              <span className="sr-only">Cargando documentos…</span>
              {[0, 1, 2].map((i) => (
                <DocumentCardSkeleton key={i} />
              ))}
            </div>
          )}

          {data && (
            <div className={`space-y-3 lg:space-y-5 transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
              {data.items.map((doc, index) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  highlight={index === 0}
                  linkState={{ catalogSearch: location.search }}
                />
              ))}

              {data.items.length === 0 && (
                <div className="bg-white rounded-card border border-faud-border-warm p-8 text-center">
                  <SearchX className="w-8 h-8 mx-auto text-faud-muted" strokeWidth={1.75} />
                  <p className="mt-3 text-body text-faud-muted">
                    {data.meta.total > 0
                      ? 'No hay resultados en esta página.'
                      : 'No se encontraron documentos con los filtros seleccionados.'}
                  </p>
                  {data.meta.total > 0 ? (
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => changePage(1)}>
                      Ir a la primera página
                    </Button>
                  ) : (
                    activeCount > 0 && (
                      <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
                        Limpiar filtros
                      </Button>
                    )
                  )}
                </div>
              )}

              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={changePage}
                className="pt-2"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
