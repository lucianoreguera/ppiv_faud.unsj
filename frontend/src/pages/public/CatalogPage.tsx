import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Badge, Chip, TIPO_DOCUMENTO_LABEL } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/FormField';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CornerAccents } from '../../components/ui/Decorations';
import { CATALOG_DOCUMENTS, DEPARTAMENTOS_SAN_JUAN } from '../../mocks/figma-fixtures';
import type { TipoDocumento } from '../../types/openapi.types';

/** Catálogo de documentos (Figma págs. 11 y 19) — Fase 2 lo conecta con GET /api/v1/documentos */
const TIPOS: TipoDocumento[] = ['TESIS', 'MONOGRAFIA', 'INVESTIGACION', 'OTROS'];

export const CatalogPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [anioDesde, setAnioDesde] = useState(2015);
  const [anioHasta, setAnioHasta] = useState(2026);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const toggleTipo = (tipo: TipoDocumento) =>
    setTipos((prev) => (prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]));

  const documents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG_DOCUMENTS.filter(
      (doc) =>
        (!q || `${doc.titulo} ${doc.autor} ${doc.palabrasClave?.join(' ') ?? ''}`.toLowerCase().includes(q)) &&
        (!departamento || doc.departamento === departamento) &&
        (tipos.length === 0 || tipos.includes(doc.tipo)) &&
        doc.anio >= anioDesde &&
        doc.anio <= anioHasta,
    );
  }, [query, departamento, tipos, anioDesde, anioHasta]);

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

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mt-4 lg:mt-10 flex gap-5 lg:max-w-[1160px]"
      >
        <div className="relative flex-1">
          <Search className="w-5 h-5 lg:w-6 lg:h-6 text-faud-muted absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isMobile ? 'Buscar documentos...' : 'Buscar por título, autor o palabra clave...'}
            aria-label="Buscar documentos"
            className="field-input h-11 lg:h-14 pl-10 lg:pl-12 text-body lg:text-[16px]"
          />
        </div>
        <button type="submit" className="hidden lg:inline-flex items-center justify-center h-14 w-[120px] rounded-input bg-faud-amber hover:bg-faud-gold-hover text-white text-[16px] font-bold">
          Buscar
        </button>
      </form>

      {/* Filtros rápidos mobile (Todos / Tesis / Monografía / Investigación) */}
      <div className="lg:hidden mt-4 -mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar">
        {[null, 'TESIS', 'MONOGRAFIA', 'INVESTIGACION'].map((tipo) => {
          const active = tipo === null ? tipos.length === 0 : tipos.length === 1 && tipos[0] === tipo;
          return (
            <button
              key={tipo ?? 'todos'}
              type="button"
              onClick={() => setTipos(tipo ? [tipo as TipoDocumento] : [])}
              className={`shrink-0 h-8 px-3.5 rounded-pill text-caption border ${
                active
                  ? 'bg-faud-ink border-faud-ink text-white font-bold'
                  : 'bg-white border-faud-border-warm text-faud-text'
              }`}
            >
              {tipo ? TIPO_DOCUMENTO_LABEL[tipo as TipoDocumento] : 'Todos'}
            </button>
          );
        })}
      </div>

      <div className="mt-5 lg:mt-6 flex gap-6 items-start">
        {/* Panel de filtros (desktop) */}
        <aside className="hidden lg:block relative w-[280px] shrink-0 bg-white rounded-card border border-faud-border-warm px-6 pt-7 pb-6">
          <CornerAccents corners={['tl', 'tr']} inset={-1} size={20} className="border-faud-amber" />
          <h2 className="text-[18px] font-bold text-faud-ink pb-4 border-b border-faud-border-warm">Filtros</h2>

          <div className="py-5 border-b border-faud-border-warm">
            <SelectField
              label="Departamento"
              placeholder="Seleccioná tu departamento"
              options={DEPARTAMENTOS_SAN_JUAN}
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              className="h-11 !pl-3 !pr-8 text-[13px]"
            />
          </div>

          <fieldset className="py-5 border-b border-faud-border-warm">
            <legend className="field-label float-left w-full">Tipo de documento</legend>
            <div className="clear-both space-y-3">
              {TIPOS.map((tipo) => (
                <label key={tipo} className="flex items-center gap-3 text-body text-faud-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tipos.includes(tipo)}
                    onChange={() => toggleTipo(tipo)}
                    className="w-[18px] h-[18px] rounded-checkbox border border-faud-border-warm accent-faud-amber"
                  />
                  {TIPO_DOCUMENTO_LABEL[tipo]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="pt-5">
            <span className="field-label">Año de publicación</span>
            <div className="flex items-center gap-3">
              <input
                type="number"
                aria-label="Año desde"
                value={anioDesde}
                onChange={(e) => setAnioDesde(Number(e.target.value))}
                className="field-input h-10 px-4"
              />
              <span className="text-faud-muted">-</span>
              <input
                type="number"
                aria-label="Año hasta"
                value={anioHasta}
                onChange={(e) => setAnioHasta(Number(e.target.value))}
                className="field-input h-10 px-4"
              />
            </div>
          </div>
        </aside>

        {/* Resultados */}
        <section aria-label="Resultados del catálogo" className="flex-1 min-w-0 space-y-3 lg:space-y-5">
          {documents.map((doc, index) => (
            <article
              key={doc.id}
              className="relative bg-white rounded-card border border-faud-border-warm px-3 py-3 lg:px-6 lg:py-[18px] flex flex-col lg:flex-row lg:items-start gap-2 lg:gap-6"
            >
              <CornerAccents
                corners={['tl', 'tr']}
                inset={-1}
                size={14}
                className={index === 0 ? 'border-faud-amber lg:border-faud-border-warm' : 'border-faud-border-warm'}
              />

              {/* Mobile: estado + tipo arriba */}
              <div className="lg:hidden flex items-center justify-between">
                <Badge variant={doc.disponible ? 'success' : 'warning'} dot size="xs">
                  {doc.disponible ? 'Disponible' : 'Prestado'}
                </Badge>
                <span className="text-[11px] font-bold text-faud-gold-dark">{TIPO_DOCUMENTO_LABEL[doc.tipo]}</span>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] lg:text-[18px] font-bold text-faud-ink leading-snug">{doc.titulo}</h2>
                <div className="hidden lg:flex gap-2 mt-1.5">
                  <Chip>{TIPO_DOCUMENTO_LABEL[doc.tipo]}</Chip>
                  <Chip tone="green">{doc.carrera}</Chip>
                </div>
                <p className="hidden lg:block mt-2.5 text-body text-faud-muted">
                  Autor: {doc.autorCorto} · {doc.anio} · Dpto. {doc.departamento}
                </p>
                <p className="lg:hidden mt-0.5 text-[11px] leading-snug text-faud-muted">
                  Autor: {doc.autorCorto} · {doc.anio}
                  <br />
                  Dpto. {doc.departamento} · {doc.carrera}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 lg:w-[175px] shrink-0">
                <Badge variant={doc.disponible ? 'success' : 'warning'} dot className="hidden lg:inline-flex">
                  {doc.disponible ? 'Disponible' : 'Prestado'}
                </Badge>
                <Link
                  to={`/documentos/${doc.id}`}
                  className={buttonClasses('secondary', 'md', 'w-full h-8 lg:h-10 text-caption lg:text-body rounded-input')}
                >
                  Ver detalle
                </Link>
              </div>
            </article>
          ))}

          {documents.length === 0 && (
            <p className="bg-white rounded-card border border-faud-border-warm p-8 text-center text-body text-faud-muted">
              No se encontraron documentos con los filtros seleccionados.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
