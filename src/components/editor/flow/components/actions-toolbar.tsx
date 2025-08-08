// src/components/editor/flow/components/ActionsToolbar.tsx
import { Button } from '@/components/ui/button';

interface Props {
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
  hint: string | null;
  onDownload?: () => void;
  hasVideo: boolean;
}

export function ActionsToolbar({ onGenerate, canGenerate, isGenerating, hint, onDownload, hasVideo }: Props) {
  return (
    <div className="absolute top-4 right-4 space-y-2">
      <Button onClick={onGenerate} disabled={isGenerating || !canGenerate} variant="success" size="sm">
        {isGenerating ? 'Generating...' : 'Generate Video'}
      </Button>

      {!canGenerate && hint && (
        <div className="text-xs text-yellow-400 bg-gray-800 p-2 rounded max-w-48">{hint}</div>
      )}

      {hasVideo && onDownload && (
        <Button onClick={onDownload} variant="primary" size="sm" className="block w-full">
          Download MP4
        </Button>
      )}
    </div>
  );
}


