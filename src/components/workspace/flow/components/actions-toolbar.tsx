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
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
  hint: string | null;
  onDownload?: () => void;
  hasVideo: boolean;
  // Multi-video support
  videos?: VideoJob[];
  onDownloadAll?: () => void;
  lastError?: string | null;
  onResetGeneration?: () => void;
  validationSummary?: ValidationSummary | null;
}

export function ActionsToolbar({ 
  onGenerate, 
  canGenerate, 
  isGenerating, 
  hint, 
  onDownload, 
  hasVideo,
  videos = [],
  onDownloadAll,
  lastError,
  onResetGeneration,
  validationSummary
}: Props) {
  const getGenerateButtonText = () => {
    if (isGenerating) return 'Generating...';
    if (lastError || validationSummary?.hasErrors) return 'Fix Issues & Try Again';
    return 'Generate Video';
  };

  const getGenerateButtonVariant = () => {
    if (lastError || validationSummary?.hasErrors) return 'danger' as const;
    return 'success' as const;
  };

  return (
    <div className="absolute top-4 right-4 space-y-2 max-w-80">
      <Button 
        onClick={onGenerate} 
        disabled={!canGenerate || isGenerating} 
        variant={getGenerateButtonVariant()}
        size="sm"
        className="w-full"
      >
        {getGenerateButtonText()}
      </Button>

      {/* Enhanced validation error display */}
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
              
              {/* Suggestions for primary error */}
              {validationSummary.primaryError.suggestions && validationSummary.primaryError.suggestions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-red-400 text-xs font-medium">How to fix:</div>
                  <ul className="text-red-300 text-xs space-y-1">
                    {validationSummary.primaryError.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span className="text-red-400">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Additional errors count */}
          {validationSummary.errorCount > 1 && (
            <div className="text-xs text-red-400 pt-2 border-t border-red-800">
              + {validationSummary.errorCount - 1} more error{validationSummary.errorCount - 1 !== 1 ? 's' : ''} detected
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
          
          {validationSummary.warnings.slice(0, 2).map((warning, index) => (
            <div key={index} className="text-yellow-300">
              {warning.message}
            </div>
          ))}
          
          {validationSummary.warningCount > 2 && (
            <div className="text-xs text-yellow-400">
              + {validationSummary.warningCount - 2} more warning{validationSummary.warningCount - 2 !== 1 ? 's' : ''}
            </div>
          )}
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

      {/* Hint display when no errors */}
      {!lastError && !validationSummary?.hasErrors && !canGenerate && hint && (
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
          
          <div className="space-y-1">
            {videos.slice(0, 3).map((video) => (
              <div key={video.jobId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    video.status === 'completed' ? 'bg-green-400' :
                    video.status === 'processing' ? 'bg-yellow-400 animate-pulse' :
                    video.status === 'failed' ? 'bg-red-400' :
                    'bg-gray-500'
                  }`} />
                  <span className="text-gray-300 truncate">{video.sceneName}</span>
                </div>
                <span className="text-gray-400">
                  {video.status === 'completed' && '✓'}
                  {video.status === 'processing' && '⏳'}
                  {video.status === 'failed' && '✗'}
                  {video.status === 'pending' && '⏸'}
                </span>
              </div>
            ))}
            {videos.length > 3 && (
              <div className="text-gray-400 text-center">
                +{videos.length - 3} more videos
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legacy single video download */}
      {hasVideo && onDownload && !isGenerating && videos.length === 0 && (
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

      {/* Enhanced help text with validation awareness */}
      {!isGenerating && !lastError && !validationSummary?.hasErrors && (
        <div className="text-xs text-gray-500 bg-gray-800/50 p-2 rounded">
          <div className="font-medium mb-1">Tips:</div>
          <ul className="space-y-1 text-gray-400">
            <li>• Connect geometry → insert → scene</li>
            <li>• Use merge for duplicate objects</li>
            <li>• All validation happens at generation time</li>
            <li>• Check auth status if stuck</li>
          </ul>
        </div>
      )}
    </div>
  );
}