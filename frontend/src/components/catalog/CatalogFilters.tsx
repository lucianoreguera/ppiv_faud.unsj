import React from 'react';
import { RotateCcw } from 'lucide-react';
import { TIPO_DOCUMENTO_LABEL } from '../ui/Badge';
import { CornerAccents } from '../ui/Decorations';
import { SelectField, type SelectOption } from '../ui/FormField';
import { CARRERAS_FAUD, TIPOS_DOCUMENTO, type TipoDocumento } from '../../types/openapi.types';
import type { CatalogFilters } from '../../pages/public/catalog-params';

export interface YearDraft {
  desde: string;
  hasta: string;
}

export interface CatalogFiltersPanelProps {
  id?: string;
  filters: CatalogFilters;
  departmentOptions: SelectOption[];
  departmentsLoading: boolean;
  yearDraft: YearDraft;
  yearError?: string;
  activeCount: number;
  onChange: (patch: Partial<CatalogFilters>) => void;
  onYearDraftChange: (draft: YearDraft) => void;
  /** Aplica el rango sin esperar el debounce (blur / Enter) */
  onYearCommit: () => void;
  onClear: () => void;
  className?: string;
}

const radioClass = 'w-[18px] h-[18px] border border-faud-border-warm accent-faud-amber';

/** Panel de filtros combinables del catálogo (Figma pág. 11) */
export const CatalogFiltersPanel: React.FC<CatalogFiltersPanelProps> = ({
  id,
  filters,
  departmentOptions,
  departmentsLoading,
  yearDraft,
  yearError,
  activeCount,
  onChange,
  onYearDraftChange,
  onYearCommit,
  onClear,
  className = '',
}) => {
  const handleYearKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onYearCommit();
    }
  };

  return (
    <aside
      id={id}
      aria-label="Filtros del catálogo"
      className={`relative w-full lg:w-[280px] shrink-0 bg-white rounded-card border border-faud-border-warm px-5 lg:px-6 pt-5 lg:pt-7 pb-6 ${className}`}
    >
      <CornerAccents corners={['tl', 'tr']} inset={-1} size={20} className="border-faud-amber" />
      <h2 className="text-[18px] font-bold text-faud-ink pb-4 border-b border-faud-border-warm">Filtros</h2>

      <div className="py-5 border-b border-faud-border-warm space-y-4">
        <SelectField
          label="Departamento de origen"
          placeholder={departmentsLoading ? 'Cargando departamentos…' : 'Todos los departamentos'}
          options={departmentOptions}
          value={filters.departamentoId ?? ''}
          disabled={departmentsLoading && departmentOptions.length === 0}
          onChange={(e) => onChange({ departamentoId: e.target.value || undefined })}
          className="h-11 !pl-3 !pr-8 text-[13px]"
        />
        <SelectField
          label="Carrera"
          placeholder="Todas las carreras"
          options={CARRERAS_FAUD}
          value={filters.carrera ?? ''}
          onChange={(e) => onChange({ carrera: e.target.value || undefined })}
          className="h-11 !pl-3 !pr-8 text-[13px]"
        />
      </div>

      {/* En mobile el tipo se elige con los chips superiores (Figma pág. 19) */}
      <fieldset className="hidden lg:block py-5 border-b border-faud-border-warm">
        <legend className="field-label float-left w-full">Tipo de documento</legend>
        <div className="clear-both space-y-3">
          {([undefined, ...TIPOS_DOCUMENTO] as (TipoDocumento | undefined)[]).map((tipo) => (
            <label
              key={tipo ?? 'todos'}
              className="flex items-center gap-3 text-body text-faud-text cursor-pointer select-none"
            >
              <input
                type="radio"
                name="catalogo-tipo"
                checked={filters.tipo === tipo}
                onChange={() => onChange({ tipo })}
                className={radioClass}
              />
              {tipo ? TIPO_DOCUMENTO_LABEL[tipo] : 'Todos los tipos'}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="py-5 border-b border-faud-border-warm">
        <span className="field-label">Año de publicación</span>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="Desde"
            aria-label="Año desde"
            aria-invalid={yearError ? true : undefined}
            value={yearDraft.desde}
            onChange={(e) => onYearDraftChange({ ...yearDraft, desde: e.target.value.replace(/\D/g, '') })}
            onBlur={onYearCommit}
            onKeyDown={handleYearKeyDown}
            className={`field-input h-10 px-4 ${yearError ? '!border-status-danger' : ''}`}
          />
          <span className="text-faud-muted">-</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="Hasta"
            aria-label="Año hasta"
            aria-invalid={yearError ? true : undefined}
            value={yearDraft.hasta}
            onChange={(e) => onYearDraftChange({ ...yearDraft, hasta: e.target.value.replace(/\D/g, '') })}
            onBlur={onYearCommit}
            onKeyDown={handleYearKeyDown}
            className={`field-input h-10 px-4 ${yearError ? '!border-status-danger' : ''}`}
          />
        </div>
        {yearError && (
          <p role="alert" className="mt-1.5 text-caption text-status-danger">
            {yearError}
          </p>
        )}
      </div>

      <div className="pt-5">
        <label className="flex items-center gap-3 text-body text-faud-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.disponible === true}
            onChange={(e) => onChange({ disponible: e.target.checked ? true : undefined })}
            className="w-[18px] h-[18px] rounded-checkbox border border-faud-border-warm accent-faud-amber"
          />
          Solo disponibles para préstamo
        </label>
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 inline-flex items-center gap-2 text-body font-bold text-faud-gold-dark hover:underline"
        >
          <RotateCcw className="w-4 h-4" />
          Limpiar filtros ({activeCount})
        </button>
      )}
    </aside>
  );
};
