'use client';

import { useRef } from 'react';
import { Upload, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/shared/types/assets';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
  uploadProgress: UploadProgress[];
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onMouseLeave,
  onDrop,
  isDragOver,
  uploadProgress,
  accept = 'image/*,video/*',
  multiple = true,
  disabled = false,
  className,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Clear input for re-selection
    e.target.value = '';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Zone */}
      <div
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onMouseLeave={onMouseLeave}
        onDrop={onDrop}
        onClick={handleClick}
        className={cn(
          'relative cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed p-[var(--space-5)] text-center transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)]',
          isDragOver
            ? 'border-[var(--accent-primary)] bg-[var(--purple-shadow-subtle)] shadow-[0_0_5px_var(--purple-shadow-subtle)]'
            : 'border-[var(--border-secondary)] hover:border-[var(--accent-primary)] hover:bg-[var(--purple-shadow-subtle)] hover:shadow-[0_0_5px_var(--purple-shadow-subtle)]',
          disabled && 'cursor-not-allowed opacity-50',
          'group'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-[var(--space-3)]">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)]',
              isDragOver
                ? 'bg-[var(--accent-primary)] text-[var(--text-primary)]'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] group-hover:bg-[var(--purple-shadow-subtle)] group-hover:text-[var(--accent-primary)]'
            )}
          >
            <Upload size={20} />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--text-primary)] transition-all duration-200 group-hover:text-[var(--accent-primary)]">
              {isDragOver ? '🎯 Drop files here' : 'Drop files or click to upload'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] transition-all duration-200 group-hover:text-[var(--accent-primary)]">
              {isDragOver ? 'Release to start uploading' : 'Images up to 50MB, videos up to 500MB'}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-[var(--text-secondary)]">
            Uploading {uploadProgress.length} file
            {uploadProgress.length > 1 ? 's' : ''}
          </div>

          <div className="space-y-3">
            {uploadProgress.map((progress, index) => (
              <UploadProgressItem key={index} progress={progress} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface UploadProgressItemProps {
  progress: UploadProgress;
}

function UploadProgressItem({ progress }: UploadProgressItemProps) {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'pending':
      case 'uploading':
        return <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />;
      case 'completed':
        return <CheckCircle size={16} className="text-[var(--success-500)]" />;
      case 'error':
        return <AlertCircle size={16} className="text-[var(--danger-500)]" />;
      default:
        return <File size={16} className="text-[var(--text-tertiary)]" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'uploading':
        return 'bg-[var(--accent-primary)]';
      case 'completed':
        return 'bg-[var(--success-500)]';
      case 'error':
        return 'bg-[var(--danger-500)]';
      default:
        return 'bg-[var(--surface-3)]';
    }
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-3)]">
      <div className="flex items-center gap-[var(--space-3)]">
        {getStatusIcon()}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">
              {progress.file.name}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {formatFileSize(progress.file.size)}
            </span>
          </div>

          {progress.status === 'error' && progress.error ? (
            <p className="text-xs text-[var(--danger-500)]">{progress.error}</p>
          ) : (
            <>
              {/* Progress bar */}
              <div className="mb-1 h-1.5 w-full rounded-full bg-[var(--surface-3)]">
                <div
                  className={cn(
                    'h-1.5 rounded-[var(--radius-full)] transition-all duration-[var(--duration-medium)] ease-[var(--easing-standard)]',
                    getStatusColor()
                  )}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                <span>
                  {progress.status === 'completed'
                    ? 'Upload complete'
                    : progress.status === 'uploading'
                      ? `${progress.progress}%`
                      : 'Preparing...'}
                </span>
                {progress.status === 'uploading' && <span>{progress.progress}%</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
