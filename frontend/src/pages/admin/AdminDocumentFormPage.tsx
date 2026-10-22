import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownFromLine, ArrowLeft, FileText, X } from 'lucide-react';
import { catalogApi } from '../../api/catalog.api';
import { ApiHttpError, type UploadProgress } from '../../api/http-client';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Alert } from '../../components/ui/Alert';
import { AvailabilityBadge, KeywordTag, TIPO_DOCUMENTO_LABEL_LARGO } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../components/ui/FormField';
import { useToast } from '../../context/ToastContext';
import { useDepartmentOptions } from '../../hooks/useDepartmentOptions';
import { describeApiError, isAbortError } from '../../utils/api-error';
import { CARRERAS_FAUD, TIPOS_DOCUMENTO, type DocumentItemDto, type TipoDocumento } from '../../types/openapi.types';
import {
  EMPTY_DOCUMENT_FORM,
  addKeywords,
  documentToFormValues,
  formatFileSize,
  toCreateDocumentDto,
  toUpdateDocumentDto,
  validateDocumentForm,
  validatePdfFile,
  type DocumentFormErrors,
  type DocumentFormValues,
} from './document-form';

/**
 * Cargar / editar documento (Figma págs. 7 y 16 · Spec FE-05 regla 2 · RF01)
 * - `/admin/catalogo/nuevo`: POST /api/v1/documentos (multipart con PDF ≤ 50 MB y barra de progreso).
 * - `/admin/catalogo/:id/editar`: PATCH /api/v1/documentos/:id (JSON, o multipart si se reemplaza el PDF).
 */
const TIPO_OPTIONS = TIPOS_DOCUMENTO.map((tipo) => ({ value: tipo, label: TIPO_DOCUMENTO_LABEL_LARGO[tipo] }));

const SkeletonBar: React.FC<{ className: string }> = ({ className }) => (
  <div className={`h-5 rounded-[4px] ${className}`} />
);

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; documento: DocumentItemDto | null }
  | { status: 'error'; message: string; notFound: boolean };

export const AdminDocumentFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const mode = id ? 'edit' : 'create';
  const navigate = useNavigate();
  const { showToast } = useToast();
  const departments = useDepartmentOptions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const [load, setLoad] = useState<LoadState>(id ? { status: 'loading' } : { status: 'ready', documento: null });
  const [reloadToken, setReloadToken] = useState(0);
  const [values, setValues] = useState<DocumentFormValues>(EMPTY_DOCUMENT_FORM);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<DocumentFormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);

  // Edición: precarga la ficha actual
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoad({ status: 'loading' });
    catalogApi
      .getById(id, controller.signal)
      .then((documento) => {
        if (controller.signal.aborted) return;
        setValues(documentToFormValues(documento));
        setLoad({ status: 'ready', documento });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const notFound = error instanceof ApiHttpError && (error.code === 'NOT_FOUND' || error.status === 400);
        setLoad({ status: 'error', message: describeApiError(error), notFound });
      });
    return () => controller.abort();
  }, [id, reloadToken]);

  // Cancela una subida en curso si se abandona la página
  useEffect(() => () => uploadControllerRef.current?.abort(), []);

  const set = <K extends keyof DocumentFormValues>(key: K, value: DocumentFormValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validateDocumentForm(next, file, mode));
  };

  const commitKeywordDraft = () => {
    if (!keywordDraft.trim()) return values.palabrasClave;
    const next = addKeywords(values.palabrasClave, keywordDraft);
    set('palabrasClave', next);
    setKeywordDraft('');
    return next;
  };

  const handleKeywordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    commitKeywordDraft();
  };

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const fileError = validatePdfFile(candidate);
    if (fileError) {
      setErrors((prev) => ({ ...prev, archivo: fileError }));
      showToast({ title: 'Archivo no válido', description: fileError, variant: 'warning' });
      return;
    }
    setFile(candidate);
    setErrors((prev) => ({ ...prev, archivo: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formValues = { ...values, palabrasClave: commitKeywordDraft() };
    const validation = validateDocumentForm(formValues, file, mode);
    setSubmitted(true);
    setErrors(validation);
    setServerErrors(null);
    if (Object.values(validation).some(Boolean)) return;

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setSubmitting(true);
    setProgress(file ? { loaded: 0, total: file.size, percent: 0 } : null);
    const uploadOptions = { signal: controller.signal, onUploadProgress: setProgress };
    try {
      const result =
        mode === 'create'
          ? await catalogApi.create(toCreateDocumentDto(formValues, file!), uploadOptions)
          : await catalogApi.update(id!, toUpdateDocumentDto(formValues), file, uploadOptions);
      showToast({
        title: mode === 'create' ? 'Documento catalogado' : 'Documento actualizado',
        description: `“${result.documento.titulo}”. ${result.message}`,
        variant: 'success',
      });
      navigate('/admin/catalogo');
    } catch (error) {
      if (isAbortError(error)) return;
      setServerErrors(error instanceof ApiHttpError ? error.rawMessages : [describeApiError(error)]);
    } finally {
      if (!controller.signal.aborted) {
        setSubmitting(false);
        setProgress(null);
      }
      uploadControllerRef.current = null;
    }
  };

  const cancelUpload = () => {
    uploadControllerRef.current?.abort();
    setSubmitting(false);
    setProgress(null);
    showToast({ title: 'Carga cancelada', description: 'El documento no se guardó.', variant: 'info' });
  };

  const documento = load.status === 'ready' ? load.documento : null;
  const title = mode === 'create' ? 'Cargar documento' : 'Editar documento';
  const hasPreview = Boolean(values.titulo || values.autor);
  const departamentoNombre = departments.options.find((d) => d.value === values.departamentoOrigenId)?.label;
  const errorCount = Object.values(errors).filter(Boolean).length;

  if (load.status !== 'ready') {
    return (
      <>
        <AdminPageHeader title={title} subtitle="Completá los metadatos y subí el archivo digital." />
        {load.status === 'loading' ? (
          <div role="status" className="h-[420px] rounded-card bg-white border border-faud-border-warm animate-pulse">
            <span className="sr-only">Cargando documento…</span>
          </div>
        ) : (
          <div className="max-w-xl">
            <Alert variant="danger" title={load.notFound ? 'Documento no encontrado' : 'No pudimos cargar el documento'}>
              {load.message}
            </Alert>
            <div className="mt-4 flex gap-3">
              {!load.notFound && <Button onClick={() => setReloadToken((t) => t + 1)}>Reintentar</Button>}
              <Link to="/admin/catalogo" className="inline-flex items-center gap-2 h-11 px-4 text-body font-bold text-faud-gold-dark">
                <ArrowLeft className="w-4 h-4" /> Volver al catálogo
              </Link>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={title}
        subtitle={
          mode === 'create'
            ? 'Completá los metadatos y subí el archivo digital.'
            : 'Actualizá los metadatos, la disponibilidad o reemplazá el archivo PDF.'
        }
      />

      <div className="flex flex-col xl:flex-row gap-5 xl:gap-10 items-start">
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label={title}
          className="w-full xl:flex-1 xl:min-w-0 lg:bg-white lg:rounded-card lg:border lg:border-faud-border-warm lg:px-[30px] lg:pt-9 lg:pb-9"
        >
          <h2 className="hidden lg:block text-[18px] font-bold text-faud-ink mb-1">Detalles del documento</h2>

          {submitted && errorCount > 0 && (
            <Alert variant="danger" title="Revisá los campos marcados" className="mb-3">
              {errorCount === 1 ? 'Hay 1 campo con errores.' : `Hay ${errorCount} campos con errores.`}
            </Alert>
          )}
          {serverErrors && (
            <Alert variant="danger" title={mode === 'create' ? 'No se pudo catalogar el documento' : 'No se pudo actualizar el documento'} className="mb-3">
              <ul className="list-disc pl-4">
                {serverErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <fieldset disabled={submitting} className="space-y-3 lg:space-y-2.5">
            <TextField
              plainLabel
              label="Título *"
              value={values.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              placeholder="Ej: Planificación Urbana Sostenible"
              maxLength={250}
              error={errors.titulo}
            />
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-5">
              <TextField
                plainLabel
                label="Autor/es *"
                value={values.autor}
                onChange={(e) => set('autor', e.target.value)}
                placeholder="Ej: Arq. María García"
                maxLength={180}
                wrapperClassName="lg:flex-1"
                error={errors.autor}
              />
              <TextField
                plainLabel
                label="Año *"
                type="number"
                inputMode="numeric"
                value={values.anio}
                onChange={(e) => set('anio', e.target.value)}
                placeholder="2023"
                wrapperClassName="lg:w-[150px]"
                error={errors.anio}
              />
            </div>
            <TextField
              plainLabel
              label="Director/a"
              value={values.director}
              onChange={(e) => set('director', e.target.value)}
              placeholder="Ej: Dr. Arq. Roberto Sánchez (opcional)"
              maxLength={180}
              error={errors.director}
            />
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-5">
              <SelectField
                plainLabel
                label="Tipo de Documento *"
                options={TIPO_OPTIONS}
                value={values.tipo}
                onChange={(e) => set('tipo', e.target.value as TipoDocumento)}
                wrapperClassName="lg:flex-1"
              />
              <SelectField
                plainLabel
                label="Carrera *"
                options={
                  CARRERAS_FAUD.includes(values.carrera as (typeof CARRERAS_FAUD)[number])
                    ? CARRERAS_FAUD
                    : [values.carrera, ...CARRERAS_FAUD]
                }
                value={values.carrera}
                onChange={(e) => set('carrera', e.target.value)}
                wrapperClassName="lg:flex-1"
                error={errors.carrera}
              />
            </div>
            {/* El Backend no permite desvincular el departamento por PATCH: en edición solo se puede cambiar por otro */}
            <SelectField
              plainLabel
              label="Departamento de San Juan vinculado"
              placeholder={
                departments.status === 'loading'
                  ? 'Cargando departamentos…'
                  : documento?.departamentoOrigenId
                    ? undefined
                    : 'Sin departamento asociado'
              }
              options={departments.options}
              value={values.departamentoOrigenId}
              onChange={(e) => set('departamentoOrigenId', e.target.value)}
            />
            <TextField
              plainLabel
              label="Palabras clave *"
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              onBlur={commitKeywordDraft}
              placeholder="Añadir palabras clave y presionar Enter"
              error={errors.palabrasClave}
            />
          </fieldset>

          {values.palabrasClave.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Palabras clave agregadas">
              {values.palabrasClave.map((kw) => (
                <KeywordTag
                  key={kw}
                  size="sm"
                  onRemove={
                    submitting ? undefined : () => set('palabrasClave', values.palabrasClave.filter((k) => k !== kw))
                  }
                >
                  {kw}
                </KeywordTag>
              ))}
            </div>
          )}

          <fieldset disabled={submitting} className="mt-3 space-y-3">
            <TextAreaField
              plainLabel
              label="Resumen *"
              value={values.resumen}
              onChange={(e) => set('resumen', e.target.value)}
              placeholder="Resumen académico (abstract) del documento"
              rows={4}
              error={errors.resumen}
            />
            <label className="flex items-start gap-3 text-body text-faud-text cursor-pointer">
              <input
                type="checkbox"
                checked={values.disponible}
                onChange={(e) => set('disponible', e.target.checked)}
                className="mt-0.5 w-[18px] h-[18px] accent-faud-amber"
              />
              <span>
                Disponible para préstamos digitales
                <span className="block text-caption text-faud-muted">
                  Si lo desmarcás, la obra queda suspendida: se ve en el catálogo pero no admite nuevas solicitudes.
                </span>
              </span>
            </label>
          </fieldset>

          <p className="mt-3 text-body text-faud-text mb-1.5">
            {mode === 'create' ? 'Archivo digital (PDF) *' : 'Reemplazar archivo PDF (opcional)'}
          </p>
          <div
            role="button"
            tabIndex={submitting ? -1 : 0}
            aria-label={file ? `Archivo seleccionado: ${file.name}. Seleccionar otro PDF` : 'Seleccionar archivo PDF'}
            aria-invalid={Boolean(errors.archivo)}
            aria-disabled={submitting}
            onClick={() => !submitting && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (submitting || (e.key !== 'Enter' && e.key !== ' ')) return;
              e.preventDefault();
              fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!submitting) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!submitting) acceptFile(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center justify-center h-[100px] lg:h-[120px] rounded-[4px] border-[1.5px] border-dashed cursor-pointer transition-colors ${
              errors.archivo ? 'border-status-danger' : 'border-faud-amber'
            } ${dragging ? 'bg-faud-amber-light' : 'bg-faud-cream'}`}
          >
            {file ? (
              <>
                <FileText className="w-7 h-7 text-faud-amber" />
                <p className="mt-1.5 text-body font-bold text-faud-ink truncate max-w-[90%]">{file.name}</p>
                <p className="text-caption text-faud-muted">{formatFileSize(file.size)} · Clic para reemplazar</p>
              </>
            ) : (
              <>
                <ArrowDownFromLine className="w-7 h-7 text-faud-amber" strokeWidth={1.75} />
                <p className="mt-1.5 text-caption lg:text-body text-faud-ink">
                  <span className="lg:hidden">Tocar para subir PDF</span>
                  <span className="hidden lg:inline">Arrastrá el PDF o hacé clic para seleccionarlo</span>
                </p>
                <p className="text-[10px] lg:text-caption text-faud-muted">
                  Máx 50MB<span className="hidden lg:inline">. Formato: .pdf</span>
                </p>
              </>
            )}
          </div>
          {errors.archivo && <p className="mt-1.5 text-caption text-status-danger">{errors.archivo}</p>}
          {mode === 'edit' && (
            <p className="mt-1.5 text-caption text-faud-muted">
              {file ? (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 font-bold text-faud-gold-dark hover:text-faud-ink"
                >
                  <X className="w-3.5 h-3.5" /> Conservar el PDF actual
                </button>
              ) : (
                'Si no seleccionás un archivo nuevo, se conserva el PDF actual.'
              )}
              {file && documento && documento.prestamosActivosCount > 0 && (
                <span className="block mt-1">
                  {documento.prestamosActivosCount === 1
                    ? 'Hay 1 préstamo activo: su titular verá la nueva versión al volver a abrir el visor.'
                    : `Hay ${documento.prestamosActivosCount} préstamos activos: sus titulares verán la nueva versión al volver a abrir el visor.`}
                </span>
              )}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            data-testid="pdf-input"
            onChange={(e) => {
              acceptFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {submitting && progress && (
            <div className="mt-4">
              <div className="flex justify-between text-caption text-faud-muted mb-1">
                <span>{progress.percent < 100 ? 'Subiendo PDF…' : 'Procesando en el servidor…'}</span>
                <span>{progress.percent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Progreso de subida del PDF"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                className="h-2 rounded-full bg-faud-border-warm overflow-hidden"
              >
                <div className="h-full bg-faud-amber transition-[width]" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}

          <div className="mt-4 lg:mt-7 flex flex-col lg:flex-row gap-3 lg:gap-3">
            <Button type="submit" isLoading={submitting} className="h-11 lg:h-[44px] px-6 rounded-[4px] text-[15px]">
              {mode === 'create' ? 'Guardar y catalogar' : 'Guardar cambios'}
            </Button>
            <Button
              variant="neutral"
              onClick={submitting ? cancelUpload : () => navigate('/admin/catalogo')}
              className="h-11 lg:h-[44px] px-5 rounded-[4px] text-[15px]"
            >
              {submitting ? 'Cancelar carga' : 'Cancelar'}
            </Button>
          </div>
        </form>

        {/* Vista previa de la ficha */}
        <aside
          aria-label="Vista previa de la ficha"
          className="hidden lg:block w-full xl:w-[340px] shrink-0 bg-white rounded-card border border-faud-border-warm px-5 pt-9 pb-10"
        >
          <h2 className="text-[16px] font-bold text-faud-ink pb-4 border-b border-faud-border-warm">Vista previa de la ficha</h2>
          <div className="relative mt-5 h-[200px] rounded-[4px] border border-faud-border-warm bg-faud-cream overflow-hidden">
            <svg aria-hidden="true" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 200">
              <path d="M0 0L150 200M150 0L300 200" stroke="#E8DCC8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] bg-[#F3ECE0]" />
          </div>
          <AvailabilityBadge disponible={values.disponible} className="mt-5" />
          {hasPreview ? (
            <div className="mt-4 space-y-1">
              <p className="text-[16px] font-bold text-faud-ink leading-snug">{values.titulo || 'Título del documento'}</p>
              <p className="text-body text-faud-muted">{values.autor || 'Autor/es'}</p>
              <p className="pt-2 text-caption text-faud-muted">
                {TIPO_DOCUMENTO_LABEL_LARGO[values.tipo]} · {values.carrera}
                {values.anio && ` · ${values.anio}`}
                {departamentoNombre && ` · ${departamentoNombre}`}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <SkeletonBar className="w-[93%] bg-[#F3ECE0]" />
              <SkeletonBar className="w-[66%] bg-[#F3ECE0]" />
              <div className="flex gap-2 pt-3">
                <SkeletonBar className="h-3.5 w-[80px] bg-[#F7F2EA]" />
                <SkeletonBar className="h-3.5 w-[120px] bg-[#F7F2EA]" />
              </div>
            </div>
          )}
          <div className="mt-6 border-t border-dashed border-faud-border-warm" />
          {values.resumen.trim() ? (
            <p className="mt-5 text-caption text-faud-text leading-relaxed line-clamp-4">{values.resumen}</p>
          ) : (
            <div className="mt-5 space-y-2">
              <SkeletonBar className="h-3.5 w-full bg-[#F7F4EE]" />
              <SkeletonBar className="h-3.5 w-full bg-[#F7F4EE]" />
              <SkeletonBar className="h-3.5 w-[80%] bg-[#F7F4EE]" />
            </div>
          )}
          {values.palabrasClave.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {values.palabrasClave.map((kw) => (
                <KeywordTag key={kw} size="sm">
                  {kw}
                </KeywordTag>
              ))}
            </div>
          ) : (
            <div className="mt-9 h-10 w-[140px] rounded-[4px] bg-faud-amber-light" />
          )}
        </aside>
      </div>
    </>
  );
};
