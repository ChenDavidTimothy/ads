"use client";

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
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
  onDragLeave: (e: React.DragEvent) => void;
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
  onDragLeave,
  onDrop,
  isDragOver,
  uploadProgress,
  accept = "image/*,video/*",
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
    <div className={cn("space-y-4", className)}>
      {/* Upload Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={handleClick}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
          isDragOver 
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5" 
            : "border-[var(--border-secondary)] hover:border-[var(--border-primary)]",
          disabled && "opacity-50 cursor-not-allowed",
          "group"
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

        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
            isDragOver 
              ? "bg-[var(--accent-primary)] text-white" 
              : "bg-[var(--surface-2)] text-[var(--text-secondary)] group-hover:bg-[var(--surface-3)]"
          )}>
            <Upload size={20} />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {isDragOver ? 'Drop files here' : 'Drop files or click to upload'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Images up to 50MB, videos up to 500MB
            </p>
          </div>

          {!disabled && (
            <Button variant="secondary" size="sm" onClick={(e) => e.stopPropagation()}>
              Browse Files
            </Button>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-[var(--text-secondary)]">
            Uploading {uploadProgress.length} file{uploadProgress.length > 1 ? 's' : ''}
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
    <div className="bg-[var(--surface-1)] rounded-lg p-3 border border-[var(--border-primary)]">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
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
              <div className="w-full bg-[var(--surface-3)] rounded-full h-1.5 mb-1">
                <div
                  className={cn("h-1.5 rounded-full transition-all duration-300", getStatusColor())}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                <span>
                  {progress.status === 'completed' ? 'Upload complete' :
                   progress.status === 'uploading' ? `${progress.progress}%` :
                   'Preparing...'}
                </span>
                {progress.status === 'uploading' && (
                  <span>{progress.progress}%</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
