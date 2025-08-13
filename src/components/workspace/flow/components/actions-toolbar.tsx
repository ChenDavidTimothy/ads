// src/components/workspace/flow/components/actions-toolbar.tsx - Enhanced with validation error display
import { Button } from '@/components/ui/button';

interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  suggestions?: string[];
  nodeId?: string;
  nodeName?: string;
}

interface ValidationSummary {
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  primaryError: ValidationError | null;
  allSuggestions: string[];
}

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface Props {
  // Video generation
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
  onDownload?: () => void;
  hasVideo: boolean;
  videos?: VideoJob[];
  onDownloadAll?: () => void;

  // Image generation
  onGenerateImage: () => void;
  canGenerateImage: boolean;
  isGeneratingImage: boolean;
  onDownloadImage?: () => void;
  hasImage: boolean;

  // Shared
  lastError?: string | null;
  onResetGeneration?: () => void;
  validationSummary?: ValidationSummary | null;
}

export function ActionsToolbar({ 
  // Video
  onGenerate, 
  canGenerate, 
  isGenerating, 
  onDownload, 
  hasVideo,
  videos = [],
  onDownloadAll,
  // Image
  onGenerateImage,
  canGenerateImage,
  isGeneratingImage,
  onDownloadImage,
  hasImage,
  // Shared
  lastError,
  onResetGeneration,
  validationSummary
}: Props) {
  const getVideoButtonText = () => {
    if (isGenerating) return 'Generating...';
    if (lastError || validationSummary?.hasErrors) return 'Fix Issues & Try Again';
    return 'Generate Video';
  };

  const getVideoButtonVariant = () => {
    if (lastError || validationSummary?.hasErrors) return 'danger' as const;
    return 'success' as const;
  };

  const getImageButtonText = () => (isGeneratingImage ? 'Generating...' : 'Generate Image');

  return (
    <div className="absolute top-4 right-4 space-y-2 max-w-80">
      <div className="flex gap-2">
        <Button 
          onClick={onGenerate} 
          disabled={!canGenerate || isGenerating} 
          variant={getVideoButtonVariant()}
          size="sm"
          className="flex-1"
        >
          {getVideoButtonText()}
        </Button>
        <Button
          onClick={onGenerateImage}
          disabled={!canGenerateImage || isGeneratingImage}
          variant="primary"
          size="sm"
          className="flex-1"
        >
          {getImageButtonText()}
        </Button>
      </div>

      {/* Validation error display */}
      {validationSummary?.hasErrors && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 p-3 rounded space-y-3">
          <div className="font-medium flex items-center justify-between">
            <span>Validation Errors ({validationSummary.errorCount})</span>
            {onResetGeneration && (
              <Button 
                onClick={onResetGeneration}
                variant="ghost" 
                size="sm"
                className="text-xs text-red-300 hover:text-red-200 border border-red-800 hover:border-red-700 px-2 py-1"
              >
                Reset
              </Button>
            )}
          </div>

          {/* Primary error */}
          {validationSummary.primaryError && (
            <div className="space-y-2">
              <div className="text-red-300 font-medium">
                {validationSummary.primaryError.message}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation warnings display */}
      {validationSummary?.hasWarnings && !validationSummary.hasErrors && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 p-3 rounded space-y-2">
          <div className="font-medium">
            Warnings ({validationSummary.warningCount})
          </div>
        </div>
      )}

      {/* Legacy error display (fallback) */}
      {lastError && !validationSummary?.hasErrors && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 p-3 rounded space-y-2">
          <div className="font-medium">Error:</div>
          <div className="text-red-300">{lastError}</div>
          {onResetGeneration && (
            <Button 
              onClick={onResetGeneration}
              variant="ghost" 
              size="sm"
              className="w-full text-xs text-red-300 hover:text-red-200 border border-red-800 hover:border-red-700"
            >
              Reset Generation
            </Button>
          )}
        </div>
      )}

      {/* Image/Video download buttons when ready */}
      {(hasVideo && onDownload) && (
        <Button onClick={onDownload} variant="primary" size="sm" className="w-full">Download MP4</Button>
      )}
      {(hasImage && onDownloadImage) && (
        <Button onClick={onDownloadImage} variant="primary" size="sm" className="w-full">Download Image</Button>
      )}

      {/* Multi-video progress display */}
      {videos.length > 0 && (
        <div className="text-xs bg-gray-800 border border-gray-600 p-3 rounded space-y-2">
          <div className="font-medium text-gray-200 flex items-center justify-between">
            <span>Videos ({videos.filter(v => v.status === 'completed').length}/{videos.length})</span>
            {videos.filter(v => v.status === 'completed').length > 1 && onDownloadAll && (
              <Button
                onClick={onDownloadAll}
                variant="primary"
                size="sm"
                className="text-xs px-2 py-1"
              >
                Download All
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}