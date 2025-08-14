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
		<div className="w-full">
			<div className="flex gap-2 justify-end">
				<Button 
					onClick={onGenerate} 
					disabled={!canGenerate || isGenerating} 
					variant={getVideoButtonVariant()}
					size="sm"
					className="min-w-36"
				>
					{getVideoButtonText()}
				</Button>
				<Button
					onClick={onGenerateImage}
					disabled={!canGenerateImage || isGeneratingImage}
					variant="primary"
					size="sm"
					className="min-w-32"
				>
					{getImageButtonText()}
				</Button>
			</div>

			{/* Validation error display */}
			{validationSummary?.hasErrors && (
				<div className="mt-2 text-xs text-[var(--danger-500)] bg-[color:rgba(220,38,38,0.08)] border border-[var(--danger-600)] p-3 rounded-[var(--radius-md)] space-y-3">
					<div className="font-medium flex items-center justify-between">
						<span>Validation Errors ({validationSummary.errorCount})</span>
						{onResetGeneration && (
							<Button 
								onClick={onResetGeneration}
								variant="ghost" 
								size="sm"
								className="text-xs text-[var(--danger-500)] hover:text-[var(--danger-600)] border border-[var(--danger-600)] px-2 py-1"
							>
								Reset
							</Button>
						)}
					</div>

					{/* Primary error */}
					{validationSummary.primaryError && (
						<div className="space-y-2">
							<div className="text-[var(--text-secondary)] font-medium">
								{validationSummary.primaryError.message}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Validation warnings display */}
			{validationSummary?.hasWarnings && !validationSummary.hasErrors && (
				<div className="mt-2 text-xs text-[var(--warning-600)] bg-[color:rgba(245,158,11,0.08)] border border-[var(--warning-600)] p-3 rounded-[var(--radius-md)] space-y-2">
					<div className="font-medium">
						Warnings ({validationSummary.warningCount})
					</div>
				</div>
			)}

			{/* Legacy error display (fallback) */}
			{lastError && !validationSummary?.hasErrors && (
				<div className="mt-2 text-xs text-[var(--danger-500)] bg-[color:rgba(220,38,38,0.08)] border border-[var(--danger-600)] p-3 rounded-[var(--radius-md)] space-y-2">
					<div className="font-medium">Error:</div>
					<div className="text-[var(--text-secondary)]">{lastError}</div>
					{onResetGeneration && (
						<Button 
							onClick={onResetGeneration}
							variant="ghost" 
							size="sm"
							className="w-full text-xs text-[var(--danger-500)] hover:text-[var(--danger-600)] border border-[var(--danger-600)]"
						>
							Reset Generation
						</Button>
					)}
				</div>
			)}

			{/* Image/Video download buttons when ready */}
			{(hasVideo && onDownload) && (
				<Button onClick={onDownload} variant="primary" size="sm" className="w-full mt-2">Download MP4</Button>
			)}
			{(hasImage && onDownloadImage) && (
				<Button onClick={onDownloadImage} variant="primary" size="sm" className="w-full mt-2">Download Image</Button>
			)}

			{/* Multi-video progress display */}
			{videos.length > 0 && (
				<div className="mt-2 text-xs bg-[var(--surface-2)] border border-[var(--border-primary)] p-3 rounded-[var(--radius-md)] space-y-2">
					<div className="font-medium text-[var(--text-secondary)] flex items-center justify-between">
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