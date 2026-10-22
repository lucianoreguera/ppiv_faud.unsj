import type {
  CreateDocumentMultipartDto,
  DocumentItemDto,
  TipoDocumento,
  UpdateDocumentDto,
} from '../../types/openapi.types';

/**
 * Formulario de catalogación (Figma págs. 7 y 16 · RF01): valores, validación en cliente
 * con las mismas reglas que CreateDocumentDto / UpdateDocumentDto del Backend y armado de los DTO.
 */
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MIN_ANIO = 1950;

export interface DocumentFormValues {
  titulo: string;
  autor: string;
  director: string;
  anio: string;
  tipo: TipoDocumento;
  carrera: string;
  departamentoOrigenId: string;
  palabrasClave: string[];
  resumen: string;
  disponible: boolean;
}

export type DocumentFormField = keyof DocumentFormValues | 'archivo';
export type DocumentFormErrors = Partial<Record<DocumentFormField, string>>;

export const EMPTY_DOCUMENT_FORM: DocumentFormValues = {
  titulo: '',
  autor: '',
  director: '',
  anio: '',
  tipo: 'TESIS',
  carrera: 'Arquitectura',
  departamentoOrigenId: '',
  palabrasClave: [],
  resumen: '',
  disponible: true,
};

export const documentToFormValues = (doc: DocumentItemDto): DocumentFormValues => ({
  titulo: doc.titulo,
  autor: doc.autor,
  director: doc.director ?? '',
  anio: String(doc.anio),
  tipo: doc.tipo,
  carrera: doc.carrera,
  departamentoOrigenId: doc.departamentoOrigenId ?? '',
  palabrasClave: [...doc.palabrasClave],
  resumen: doc.resumen,
  disponible: doc.disponible,
});

/** Solo archivos .pdf de hasta 50 MB (el Backend además verifica la firma %PDF-) */
export function validatePdfFile(file: File): string | undefined {
  const isPdf = file.name.toLowerCase().endsWith('.pdf') && (file.type === '' || file.type === 'application/pdf');
  if (!isPdf) return 'Solo se aceptan archivos en formato .pdf.';
  if (file.size === 0) return 'El archivo PDF está vacío.';
  if (file.size > MAX_PDF_BYTES) {
    return `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y supera el máximo de 50 MB.`;
  }
  return undefined;
}

/** Agrega palabras clave separadas por comas, sin duplicados (sin distinguir mayúsculas) */
export function addKeywords(current: string[], raw: string): string[] {
  const next = [...current];
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (value && !next.some((k) => k.toLowerCase() === value.toLowerCase())) next.push(value);
  }
  return next;
}

export function validateDocumentForm(
  values: DocumentFormValues,
  archivo: File | null,
  mode: 'create' | 'edit',
  currentYear = new Date().getFullYear(),
): DocumentFormErrors {
  const errors: DocumentFormErrors = {};
  const titulo = values.titulo.trim();
  const autor = values.autor.trim();
  const anio = Number(values.anio);

  if (titulo.length < 3) errors.titulo = 'El título debe tener al menos 3 caracteres.';
  else if (titulo.length > 250) errors.titulo = 'El título no puede superar los 250 caracteres.';

  if (autor.length < 2) errors.autor = 'Indicá el autor o los autores (al menos 2 caracteres).';
  else if (autor.length > 180) errors.autor = 'El autor no puede superar los 180 caracteres.';

  if (values.director.trim().length > 180) errors.director = 'El director no puede superar los 180 caracteres.';

  if (!values.anio.trim()) errors.anio = 'Indicá el año.';
  else if (!Number.isInteger(anio) || anio < MIN_ANIO || anio > currentYear + 1) {
    errors.anio = `Ingresá un año entre ${MIN_ANIO} y ${currentYear + 1}.`;
  }

  if (!values.carrera.trim()) errors.carrera = 'Seleccioná la carrera.';

  if (values.palabrasClave.length === 0) errors.palabrasClave = 'Agregá al menos una palabra clave.';

  if (values.resumen.trim().length < 10) errors.resumen = 'El resumen debe tener al menos 10 caracteres.';

  if (archivo) {
    const fileError = validatePdfFile(archivo);
    if (fileError) errors.archivo = fileError;
  } else if (mode === 'create') {
    errors.archivo = 'Seleccioná el archivo PDF del documento.';
  }

  return errors;
}

const commonFields = (values: DocumentFormValues) => ({
  titulo: values.titulo.trim(),
  autor: values.autor.trim(),
  carrera: values.carrera,
  tipo: values.tipo,
  anio: Number(values.anio),
  resumen: values.resumen.trim(),
  palabrasClave: values.palabrasClave,
  departamentoOrigenId: values.departamentoOrigenId || undefined,
  disponible: values.disponible,
});

export const toCreateDocumentDto = (values: DocumentFormValues, archivo: File): CreateDocumentMultipartDto => ({
  ...commonFields(values),
  director: values.director.trim() || undefined,
  archivo,
});

/** En la edición, un director vacío se envía como "" para que el Backend lo borre */
export const toUpdateDocumentDto = (values: DocumentFormValues): UpdateDocumentDto => ({
  ...commonFields(values),
  director: values.director.trim(),
});

export const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
