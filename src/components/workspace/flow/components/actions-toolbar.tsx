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
	const getButtonText = (isGenerating: boolean, type: 'video' | 'image') => {
		if (isGenerating) return type === 'video' ? 'Generating...' : 'Generating...';
		if (lastError || validationSummary?.hasErrors) return 'Fix Issues & Try Again';
		return type === 'video' ? 'Generate Video' : 'Generate Image';
	};

	const getButtonVariant = () => {
		if (lastError || validationSummary?.hasErrors) return 'danger' as const;
		return 'success' as const;
	};

	return (
		<div className="flex items-center gap-[var(--space-2)]">
			{/* Video Generation */}
			<Button
				onClick={onGenerate}
				disabled={!canGenerate || isGenerating}
				variant={getButtonVariant()}
				size="sm"
				className="font-medium"
			>
				{getButtonText(isGenerating, 'video')}
			</Button>

			{/* Image Generation */}
			<Button
				onClick={onGenerateImage}
				disabled={!canGenerateImage || isGeneratingImage}
				variant={getButtonVariant()}
				size="sm"
				className="font-medium"
			>
				{getButtonText(isGeneratingImage, 'image')}
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