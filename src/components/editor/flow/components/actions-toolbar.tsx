// src/components/editor/flow/components/actions-toolbar.tsx
import { Button } from '@/components/ui/button';

interface Props {
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
  hint: string | null;
  onDownload?: () => void;
  hasVideo: boolean;
  lastError?: string | null;
  onResetGeneration?: () => void;
}

export function ActionsToolbar({ 
  onGenerate, 
  canGenerate, 
  isGenerating, 
  hint, 
  onDownload, 
  hasVideo,
  lastError,
  onResetGeneration
}: Props) {
  const getGenerateButtonText = () => {
    if (isGenerating) return 'Generating...';
    if (lastError) return 'Try Again';
    return 'Generate Video';
  };

  const getGenerateButtonVariant = () => {
    if (lastError) return 'danger' as const;
    return 'success' as const;
  };

  return (
    <div className="absolute top-4 right-4 space-y-2 max-w-64">
      <Button 
        onClick={onGenerate} 
        disabled={!canGenerate || isGenerating} 
        variant={getGenerateButtonVariant()}
        size="sm"
        className="w-full"
      >
        {getGenerateButtonText()}
      </Button>

      {/* Error display with recovery options */}
      {lastError && (
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

      {/* Hint display when no error */}
      {!lastError && !canGenerate && hint && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 p-3 rounded">
          <div className="font-medium mb-1">Setup Required:</div>
          <div className="text-yellow-300">{hint}</div>
        </div>
      )}

      {/* Generation progress indicator */}
      {isGenerating && (
        <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800 p-3 rounded space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="font-medium">Generating Video...</span>
          </div>
          <div className="text-blue-300 text-xs">
            This may take 30-90 seconds depending on complexity
          </div>
          {onResetGeneration && (
            <Button 
              onClick={onResetGeneration}
              variant="ghost" 
              size="sm"
              className="w-full text-xs text-blue-300 hover:text-blue-200 border border-blue-800 hover:border-blue-700 mt-2"
            >
              Cancel Generation
            </Button>
          )}
        </div>
      )}

      {/* Success state with download */}
      {hasVideo && onDownload && !isGenerating && (
        <div className="space-y-2">
          <Button 
            onClick={onDownload} 
            variant="primary" 
            size="sm" 
            className="w-full"
          >
            Download MP4
          </Button>
          <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 p-2 rounded text-center">
            ✓ Video ready for download
          </div>
        </div>
      )}

      {/* Help text */}
      {!isGenerating && !lastError && (
        <div className="text-xs text-gray-500 bg-gray-800/50 p-2 rounded">
          <div className="font-medium mb-1">Tips:</div>
          <ul className="space-y-1 text-gray-400">
            <li>• Connect geometry → insert → scene</li>
            <li>• Use merge for duplicate objects</li>
            <li>• Check auth status if stuck</li>
          </ul>
        </div>
      )}
    </div>
  );
}