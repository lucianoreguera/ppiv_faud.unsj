import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownFromLine, FileText } from 'lucide-react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Badge, KeywordTag } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/FormField';
import { useToast } from '../../context/ToastContext';
import { CARRERAS, TIPOS_DOCUMENTO_FORM } from '../../mocks/figma-fixtures';

/** Cargar documento (Figma págs. 7 y 16) — Fase 5 lo conecta con POST /api/v1/documentos (multipart) */
const MAX_PDF_BYTES = 50 * 1024 * 1024;

const SkeletonBar: React.FC<{ className: string }> = ({ className }) => (
  <div className={`h-5 rounded-[4px] ${className}`} />
);

export const AdminDocumentUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState('');
  const [autor, setAutor] = useState('');
  const [anio, setAnio] = useState('');
  const [tipo, setTipo] = useState<string>(TIPOS_DOCUMENTO_FORM[0]);
  const [carrera, setCarrera] = useState<string>(CARRERAS[0]);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['Urbanismo', 'Sustentable']);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const addKeyword = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = keywordDraft.trim();
    if (value && !keywords.includes(value)) setKeywords((prev) => [...prev, value]);
    setKeywordDraft('');
  };

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const isPdf = candidate.type === 'application/pdf' || candidate.name.toLowerCase().endsWith('.pdf');
    if (!isPdf || candidate.size > MAX_PDF_BYTES) {
      showToast({
        title: 'Archivo no válido',
        description: 'Solo se aceptan archivos .pdf de hasta 50 MB.',
        variant: 'warning',
      });
      return;
    }
    setFile(candidate);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast({
      title: 'Catalogación disponible en la Fase 5',
      description: 'El formulario se conectará con POST /api/v1/documentos.',
      variant: 'info',
    });
  };

  const hasPreview = Boolean(titulo || autor);

  return (
    <>
      <AdminPageHeader title="Cargar documento" subtitle="Completá los metadatos y subí el archivo digital." />

      <div className="flex flex-col xl:flex-row gap-5 xl:gap-10 items-start">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="w-full xl:flex-1 xl:min-w-0 lg:bg-white lg:rounded-card lg:border lg:border-faud-border-warm lg:px-[30px] lg:pt-9 lg:pb-9"
        >
          <h2 className="hidden lg:block text-[18px] font-bold text-faud-ink mb-1">Detalles del documento</h2>

          <div className="space-y-3 lg:space-y-2.5">
            <TextField
              plainLabel
              label="Título *"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Planificación Urbana Sostenible"
            />
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-5">
              <TextField
                plainLabel
                label="Autor/es *"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="Ej: Arq. María García"
                wrapperClassName="lg:flex-1"
              />
              <TextField
                plainLabel
                label="Año *"
                type="number"
                inputMode="numeric"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                placeholder="2023"
                wrapperClassName="lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-5">
              <SelectField
                plainLabel
                label="Tipo de Documento *"
                options={TIPOS_DOCUMENTO_FORM}
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                wrapperClassName="lg:flex-1"
              />
              <SelectField
                plainLabel
                label="Carrera *"
                options={CARRERAS}
                value={carrera}
                onChange={(e) => setCarrera(e.target.value)}
                wrapperClassName="lg:flex-1"
              />
            </div>
            <TextField
              plainLabel
              label="Palabras clave"
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              onKeyDown={addKeyword}
              placeholder="Añadir palabras clave y presionar Enter"
            />
          </div>

          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <KeywordTag key={kw} size="sm" onRemove={() => setKeywords((prev) => prev.filter((k) => k !== kw))}>
                  {kw}
                </KeywordTag>
              ))}
            </div>
          )}

          <p className="mt-3 text-body text-faud-text mb-1.5">Archivo digital (PDF) *</p>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center justify-center h-[100px] lg:h-[120px] rounded-[4px] border-[1.5px] border-dashed border-faud-amber cursor-pointer transition-colors ${
              dragging ? 'bg-faud-amber-light' : 'bg-faud-cream'
            }`}
          >
            {file ? (
              <>
                <FileText className="w-7 h-7 text-faud-amber" />
                <p className="mt-1.5 text-body font-bold text-faud-ink truncate max-w-[90%]">{file.name}</p>
                <p className="text-caption text-faud-muted">{(file.size / 1024 / 1024).toFixed(2)} MB · Clic para reemplazar</p>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          <div className="mt-4 lg:mt-7 flex flex-col lg:flex-row gap-3 lg:gap-3">
            <Button type="submit" className="h-11 lg:h-[44px] px-6 rounded-[4px] text-[15px]">
              Guardar y catalogar
            </Button>
            <Button variant="neutral" onClick={() => navigate('/admin')} className="h-11 lg:h-[44px] px-5 rounded-[4px] text-[15px]">
              Cancelar
            </Button>
          </div>
        </form>

        {/* Vista previa de la ficha */}
        <aside className="hidden lg:block w-full xl:w-[340px] shrink-0 bg-white rounded-card border border-faud-border-warm px-5 pt-9 pb-10">
          <h2 className="text-[16px] font-bold text-faud-ink pb-4 border-b border-faud-border-warm">Vista previa de la ficha</h2>
          <div className="relative mt-5 h-[200px] rounded-[4px] border border-faud-border-warm bg-faud-cream overflow-hidden">
            <svg aria-hidden="true" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 200">
              <path d="M0 0L150 200M150 0L300 200" stroke="#E8DCC8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] bg-[#F3ECE0]" />
          </div>
          <Badge variant="success" dot shape="square" className="mt-5">
            Disponible
          </Badge>
          {hasPreview ? (
            <div className="mt-4 space-y-1">
              <p className="text-[16px] font-bold text-faud-ink leading-snug">{titulo || 'Título del documento'}</p>
              <p className="text-body text-faud-muted">{autor || 'Autor/es'}</p>
              <p className="pt-2 text-caption text-faud-muted">
                {tipo} · {carrera}
                {anio && ` · ${anio}`}
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
          <div className="mt-5 space-y-2">
            <SkeletonBar className="h-3.5 w-full bg-[#F7F4EE]" />
            <SkeletonBar className="h-3.5 w-full bg-[#F7F4EE]" />
            <SkeletonBar className="h-3.5 w-[80%] bg-[#F7F4EE]" />
          </div>
          <div className="mt-9 h-10 w-[140px] rounded-[4px] bg-faud-amber-light" />
        </aside>
      </div>
    </>
  );
};
