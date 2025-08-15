// src/components/workspace/flow/components/actions-toolbar.tsx - Clean generation-only toolbar
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

interface Props {
	// Video generation
	onGenerate: () => void;
	canGenerate: boolean;
	isGenerating: boolean;

	// Image generation
	onGenerateImage: () => void;
	canGenerateImage: boolean;
	isGeneratingImage: boolean;

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
	// Image
	onGenerateImage,
	canGenerateImage,
	isGeneratingImage,
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
		<div className="flex items-center gap-[var(--space-2)]">
			{/* Video Generation */}
			<Button
				onClick={onGenerate}
				disabled={!canGenerate || isGenerating}
				variant={getVideoButtonVariant()}
				size="sm"
				className="font-medium"
			>
				{getVideoButtonText()}
			</Button>

			{/* Image Generation */}
			<Button
				onClick={onGenerateImage}
				disabled={!canGenerateImage || isGeneratingImage}
				variant="secondary"
				size="sm"
			>
				{getImageButtonText()}
			</Button>

			{/* Reset/Clear button for error states */}
			{(lastError || validationSummary?.hasErrors) && onResetGeneration && (
				<Button
					onClick={onResetGeneration}
					variant="ghost"
					size="sm"
					className="text-[var(--danger-500)] hover:text-[var(--danger-600)] border border-[var(--danger-600)]"
				>
					Reset Generation
				</Button>
			)}
		</div>
	);
}