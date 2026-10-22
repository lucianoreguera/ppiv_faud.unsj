import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Paginador conectado a `meta` de la API (page, totalPages).
 * Desktop: números con elipsis · Mobile: "Página X de Y".
 */
export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

type PageItem = number | 'gap-start' | 'gap-end';

/** Primera, última y vecinas de la actual; el resto se colapsa en "…" */
export function getPageItems(page: number, totalPages: number): PageItem[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((p, index) => {
    const prev = sorted[index - 1];
    if (prev !== undefined && p - prev === 2) items.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) items.push(index === 1 ? 'gap-start' : 'gap-end');
    items.push(p);
  });
  return items;
}

const arrowClass =
  'inline-flex items-center gap-1 h-10 px-3 rounded-input border border-faud-border-warm bg-white text-body text-faud-text hover:border-faud-amber disabled:opacity-40 disabled:hover:border-faud-border-warm disabled:cursor-not-allowed';

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange, className = '' }) => {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginación" className={`flex items-center justify-between lg:justify-center gap-2 ${className}`}>
      <button type="button" className={arrowClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="w-4 h-4" />
        Anterior
      </button>

      <span className="lg:hidden text-caption text-faud-muted">
        Página {page} de {totalPages}
      </span>

      <ul className="hidden lg:flex items-center gap-1.5">
        {getPageItems(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <button
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Página ${item}`}
                className={`w-10 h-10 rounded-input text-body transition-colors ${
                  item === page
                    ? 'bg-faud-amber text-faud-ink font-bold'
                    : 'bg-white border border-faud-border-warm text-faud-text hover:border-faud-amber'
                }`}
              >
                {item}
              </button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="w-6 text-center text-faud-muted">
              …
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        className={arrowClass}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
};
