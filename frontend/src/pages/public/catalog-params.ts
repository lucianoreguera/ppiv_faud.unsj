import {
  CARRERAS_FAUD,
  TIPOS_DOCUMENTO,
  type CatalogFilterParams,
  type TipoDocumento,
} from '../../types/openapi.types';

/**
 * Filtros del catálogo público sincronizados con la URL (Spec FE-02):
 * `/catalogo?q=&departamentoId=&carrera=&tipo=&anioDesde=&anioHasta=&disponible=&page=`
 * Los valores inválidos de la URL se descartan para no provocar un 400 en GET /api/v1/documentos.
 */
export type CatalogFilters = Omit<CatalogFilterParams, 'anio' | 'limit'>;

export const CATALOG_PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 400;

/** Rango aceptado por QueryDocumentsDto (@Min(1950) · @Max(2100)) */
export const MIN_YEAR = 1950;
export const MAX_YEAR = 2100;

const PARAM_ORDER: (keyof CatalogFilters)[] = [
  'q',
  'departamentoId',
  'carrera',
  'tipo',
  'anioDesde',
  'anioHasta',
  'disponible',
  'page',
];

function parseYear(raw: string | null): number | undefined {
  if (!raw || !/^\d{4}$/.test(raw.trim())) return undefined;
  const year = Number(raw);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : undefined;
}

export function parseCatalogParams(searchParams: URLSearchParams): CatalogFilters {
  const filters: CatalogFilters = {};

  const q = searchParams.get('q')?.trim();
  if (q) filters.q = q;

  const departamentoId = searchParams.get('departamentoId')?.trim();
  if (departamentoId) filters.departamentoId = departamentoId;

  const carrera = searchParams.get('carrera');
  if (carrera && (CARRERAS_FAUD as readonly string[]).includes(carrera)) filters.carrera = carrera;

  const tipo = searchParams.get('tipo');
  if (tipo && (TIPOS_DOCUMENTO as readonly string[]).includes(tipo)) filters.tipo = tipo as TipoDocumento;

  let anioDesde = parseYear(searchParams.get('anioDesde'));
  let anioHasta = parseYear(searchParams.get('anioHasta'));
  if (anioDesde !== undefined && anioHasta !== undefined && anioDesde > anioHasta) {
    [anioDesde, anioHasta] = [anioHasta, anioDesde];
  }
  if (anioDesde !== undefined) filters.anioDesde = anioDesde;
  if (anioHasta !== undefined) filters.anioHasta = anioHasta;

  const disponible = searchParams.get('disponible');
  if (disponible === 'true' || disponible === 'false') filters.disponible = disponible === 'true';

  const page = Number(searchParams.get('page'));
  if (Number.isInteger(page) && page > 1) filters.page = page;

  return filters;
}

/** Serializa en orden estable y omite valores vacíos y la página 1 */
export function serializeCatalogParams(filters: CatalogFilters): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const key of PARAM_ORDER) {
    const value = filters[key];
    if (value === undefined || value === '') continue;
    if (key === 'page' && Number(value) <= 1) continue;
    searchParams.set(key, String(value));
  }
  return searchParams;
}

export function toCatalogApiParams(filters: CatalogFilters): CatalogFilterParams {
  return { ...filters, page: filters.page ?? 1, limit: CATALOG_PAGE_SIZE };
}

/** Cantidad de filtros activos (sin contar la página) */
export function countActiveFilters(filters: CatalogFilters): number {
  return PARAM_ORDER.filter((key) => key !== 'page' && filters[key] !== undefined).length;
}

export interface YearRangeResult {
  anioDesde?: number;
  anioHasta?: number;
  error?: string;
}

/** Valida el rango de años escrito por el usuario antes de enviarlo a la API */
export function validateYearRange(rawDesde: string, rawHasta: string): YearRangeResult {
  const desde = rawDesde.trim();
  const hasta = rawHasta.trim();
  const anioDesde = desde ? parseYear(desde) : undefined;
  const anioHasta = hasta ? parseYear(hasta) : undefined;

  if ((desde && anioDesde === undefined) || (hasta && anioHasta === undefined)) {
    return { error: `Ingresá años de 4 dígitos entre ${MIN_YEAR} y ${MAX_YEAR}.` };
  }
  if (anioDesde !== undefined && anioHasta !== undefined && anioDesde > anioHasta) {
    return { error: 'El año "desde" no puede ser mayor que el año "hasta".' };
  }
  return { anioDesde, anioHasta };
}
