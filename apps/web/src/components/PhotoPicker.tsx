import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { useT } from '../i18n/i18n';
import { cn } from '../lib/cn';
import { Button } from './ui/button';

export interface PhotoPickerProps {
  file: File | null;
  loading: boolean;
  onFileChange: (file: File | null) => void;
}

/**
 * Returns the photo picker: a desktop drag-and-drop zone with browse action and
 * a mobile gallery/camera split, sharing one validated file input and preview.
 * The analyzing overlay mirrors the real request state and never fakes success.
 */
export function PhotoPicker({ file, loading, onFileChange }: PhotoPickerProps) {
  const { t } = useT();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setPreviewUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }, [file]);

  function pickFromPicker(input: HTMLInputElement | null) {
    input?.click();
  }

  function handlePicked(next: File | null) {
    setDragging(false);
    onFileChange(next);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (loading) {
      return;
    }
    handlePicked(event.dataTransfer.files.item(0));
  }

  const preview =
    file === null ? null : (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-soft">
          {previewUrl === null ? (
            <div
              role="status"
              className="flex h-48 items-center justify-center text-sm text-muted-fg"
            >
              {t('scan.loadingPhoto')}
            </div>
          ) : (
            <img
              src={previewUrl}
              alt={t('scan.photoAlt')}
              className={cn(
                'max-h-72 w-full object-contain transition-all duration-300',
                loading && 'scale-[1.02] opacity-50 blur-[2px]',
              )}
            />
          )}
          {loading ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35">
              <div className="sp-anim-scan-line absolute inset-x-4 top-0 h-0.5 bg-fresh shadow-[0_0_12px_2px_rgba(34,197,94,0.8)]" />
              <span
                role="status"
                aria-live="polite"
                className="sp-anim-pulse relative z-10 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white"
              >
                {t('scan.analyzingPhoto')}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-muted-fg">{file.name}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => pickFromPicker(galleryInputRef.current)}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {t('scan.replace')}
            </Button>
            <Button variant="ghost" size="sm" disabled={loading} onClick={() => handlePicked(null)}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {t('scan.remove')}
            </Button>
          </div>
        </div>
      </div>
    );

  const emptyDesktopZone = (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!loading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => pickFromPicker(galleryInputRef.current)}
      className={cn(
        'hidden cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors md:flex',
        dragging ? 'border-fresh bg-mint' : 'border-border bg-surface-soft hover:border-primary',
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-primary">
        <UploadCloud aria-hidden="true" className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium">{t('scan.dropzone.title')}</p>
      <p className="text-xs text-muted-fg">{t('scan.dropHint')}</p>
      <button
        type="button"
        disabled={loading}
        onClick={(event) => {
          event.stopPropagation();
          pickFromPicker(galleryInputRef.current);
        }}
        className="pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ImageIcon aria-hidden="true" className="h-4 w-4" />
        {t('scan.browse')}
      </button>
    </div>
  );

  const emptyMobileActions = (
    <div className="space-y-3 md:hidden">
      <button
        type="button"
        onClick={() => pickFromPicker(cameraInputRef.current)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-fg shadow-sm active:opacity-90"
      >
        <Camera aria-hidden="true" className="h-5 w-5" />
        {t('scan.camera')}
      </button>
      <button
        type="button"
        onClick={() => pickFromPicker(galleryInputRef.current)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-heading shadow-sm active:opacity-90"
      >
        <ImageIcon aria-hidden="true" className="h-5 w-5" />
        {t('scan.gallery')}
      </button>
      <p className="text-center text-xs text-muted-fg">{t('scan.dropHint')}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        aria-label={t('scan.choosePhoto')}
        className="sr-only"
        disabled={loading}
        onChange={(event) => handlePicked(event.target.files?.item(0) ?? null)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={t('scan.camera')}
        className="sr-only"
        disabled={loading}
        onChange={(event) => handlePicked(event.target.files?.item(0) ?? null)}
      />

      {file === null ? (
        <>
          {emptyDesktopZone}
          {emptyMobileActions}
        </>
      ) : (
        preview
      )}
    </div>
  );
}
