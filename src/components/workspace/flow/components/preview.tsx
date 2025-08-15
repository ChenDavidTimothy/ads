// src/components/workspace/flow/components/VideoPreview.tsx - Enhanced for multi-video support and images
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface VideoJob {
	jobId: string;
	sceneName: string;
	sceneId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	videoUrl?: string;
	error?: string;
}

interface ImageJob {
	jobId: string;
	frameName: string;
	frameId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	imageUrl?: string;
	error?: string;
}

interface Props {
	videoUrl: string | null; // Legacy single video
	videos: VideoJob[]; // Multi-video support
	onDownloadVideo?: (jobId: string) => void;
	onDownloadAll?: () => void;
	// Images
	imageUrl?: string | null; // Single image quick preview
	images?: ImageJob[];
	onDownloadImage?: (jobId: string) => void;
	onDownloadAllImages?: () => void;
}

export function VideoPreview({ videoUrl, videos, onDownloadVideo, onDownloadAll, imageUrl, images = [], onDownloadImage, onDownloadAllImages }: Props) {
	const [activeVideoIndex, setActiveVideoIndex] = useState(0);
	const [activeImageIndex, setActiveImageIndex] = useState(0);
	
	const hasMultipleVideos = videos.length > 0;
	const completedVideos = videos.filter(v => v.status === 'completed' && v.videoUrl);
	const hasSingleImage = Boolean(imageUrl);
	const hasMultipleImages = images.length > 0;
	const completedImages = images.filter(i => i.status === 'completed' && i.imageUrl);
	
	// If nothing to show
	if (!hasMultipleVideos && !videoUrl && !hasSingleImage && !hasMultipleImages) return null;
	
	// Single video mode (legacy)
	if (!hasMultipleVideos && videoUrl && !hasSingleImage && !hasMultipleImages) {
		return (
			<div className="absolute bottom-[var(--space-4)] right-[var(--space-4)] w-80">
				<video src={videoUrl} controls autoPlay loop className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)]">
					Your browser does not support the video tag.
				</video>
			</div>
		);
	}

	const activeVideo = completedVideos[activeVideoIndex];
	const processingVideos = videos.filter(v => v.status === 'processing' || v.status === 'pending');
	const failedVideos = videos.filter(v => v.status === 'failed');

	const activeImage = completedImages[activeImageIndex];
	const processingImages = images.filter(i => i.status === 'processing' || i.status === 'pending');
	const failedImages = images.filter(i => i.status === 'failed');

	return (
		<div className="absolute bottom-[var(--space-4)] right-[var(--space-4)] w-96 space-y-[var(--space-3)]">
			{/* Single Image Preview */}
			{hasSingleImage && !hasMultipleImages && (
				<div className="bg-[var(--surface-1)] rounded-[var(--radius-md)] border border-[var(--border-primary)] overflow-hidden">
					<div className="bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] border-b border-[var(--border-primary)] flex items-center justify-between">
						<span className="text-sm font-medium text-[var(--text-secondary)]">Image</span>
					</div>
					<img src={imageUrl!} alt="Generated" className="w-full" />
				</div>
			)}

			{/* Multi-image mode */}
			{hasMultipleImages && (
				<div className="bg-[var(--surface-1)] rounded-[var(--radius-md)] border border-[var(--border-primary)] overflow-hidden">
					<div className="bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] border-b border-[var(--border-primary)] flex items-center justify-between">
						<span className="text-sm font-medium text-[var(--text-secondary)]">Image</span>
						{onDownloadImage && activeImage && (
							<Button
								onClick={() => onDownloadImage(activeImage.jobId)}
								variant="ghost"
								size="sm"
								className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-[var(--space-2)] py-[var(--space-1)]"
							>
								Download
							</Button>
						)}
					</div>
					{activeImage ? (
						<img src={activeImage.imageUrl} alt={activeImage.frameName} className="w-full" />
					) : (
						<div className="p-[var(--space-4)] text-center text-[var(--text-tertiary)] text-sm">Waiting for images...</div>
					)}
					{/* Image tabs */}
					<div className="bg-[var(--surface-1)] p-[var(--space-3)] border-t border-[var(--border-primary)]">
						<div className="flex items-center justify-between mb-[var(--space-2)]">
							<span className="text-xs font-medium text-[var(--text-secondary)]">
								Images ({completedImages.length}/{images.length} ready)
							</span>
							{onDownloadAllImages && completedImages.length > 1 && (
								<Button onClick={onDownloadAllImages} variant="primary" size="sm" className="text-xs px-[var(--space-2)] py-[var(--space-1)]">Download All</Button>
							)}
						</div>
						<div className="space-y-[var(--space-1)]">
							{images.map((img, _index) => {
								const isCompleted = img.status === 'completed' && img.imageUrl;
								const isActive = isCompleted && completedImages.indexOf(img) === activeImageIndex;
								return (
									<Button
										key={img.jobId}
										variant={isActive ? "primary" : "ghost"}
										size="sm"
										className="w-full justify-between"
										onClick={() => {
											if (isCompleted) {
												const idx = completedImages.indexOf(img);
												if (idx >= 0) setActiveImageIndex(idx);
											}
										}}
										disabled={!isCompleted}
									>
										<div className="flex items-center gap-[var(--space-2)]">
											<div className={`w-2 h-2 rounded-full ${
												img.status === 'completed' ? 'bg-[var(--success-500)]' :
												img.status === 'processing' ? 'bg-[var(--warning-600)] animate-pulse' :
												img.status === 'failed' ? 'bg-[var(--danger-500)]' :
												'bg-[var(--border-secondary)]'
											}`} />
											<span className="truncate">{img.frameName}</span>
										</div>
										<div className="text-xs text-[var(--text-tertiary)]">
											{img.status === 'completed' && '✓'}
											{img.status === 'processing' && '⏳'}
											{img.status === 'failed' && '✗'}
											{img.status === 'pending' && '⏸'}
										</div>
									</Button>
								);
							})}
						</div>
						<div className="mt-[var(--space-2)] pt-[var(--space-2)] border-t border-[var(--border-primary)] text-xs text-[var(--text-tertiary)]">
							{processingImages.length > 0 && (<div>⏳ {processingImages.length} processing...</div>)}
							{failedImages.length > 0 && (<div className="text-[var(--danger-500)]">✗ {failedImages.length} failed</div>)}
							{completedImages.length > 0 && (<div className="text-[var(--success-500)]">✓ {completedImages.length} completed</div>)}
						</div>
					</div>
				</div>
			)}

			{/* Multi-video mode */}
			{(hasMultipleVideos) && (
				<div className="bg-[var(--surface-1)] rounded-[var(--radius-md)] border border-[var(--border-primary)] overflow-hidden">
					{activeVideo && (
						<div>
							<div className="bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] border-b border-[var(--border-primary)] flex items-center justify-between">
								<span className="text-sm font-medium text-[var(--text-secondary)]">{activeVideo.sceneName}</span>
								{onDownloadVideo && (
									<Button
										onClick={() => onDownloadVideo(activeVideo.jobId)}
										variant="ghost"
										size="sm"
										className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-[var(--space-2)] py-[var(--space-1)]"
									>
										Download
									</Button>
								)}
							</div>
							<video 
								src={activeVideo.videoUrl} 
								controls 
								autoPlay 
								loop 
								className="w-full"
								key={activeVideo.jobId}
							>
								Your browser does not support the video tag.
							</video>
						</div>
					)}
					{/* Video tabs and summary */}
					<div className="bg-[var(--surface-1)] p-[var(--space-3)] border-t border-[var(--border-primary)]">
						<div className="flex items-center justify-between mb-[var(--space-2)]">
							<span className="text-xs font-medium text-[var(--text-secondary)]">
								Videos ({completedVideos.length}/{videos.length} ready)
							</span>
							{onDownloadAll && completedVideos.length > 1 && (
								<Button onClick={onDownloadAll} variant="primary" size="sm" className="text-xs px-[var(--space-2)] py-[var(--space-1)]">Download All</Button>
							)}
						</div>
						<div className="space-y-[var(--space-1)]">
							{videos.map((video, _index) => {
								const isCompleted = video.status === 'completed' && video.videoUrl;
								const isActive = isCompleted && completedVideos.indexOf(video) === activeVideoIndex;
								return (
									<Button
										key={video.jobId}
										variant={isActive ? "primary" : "ghost"}
										size="sm"
										className="w-full justify-between"
										onClick={() => {
											if (isCompleted) {
												const completedIndex = completedVideos.indexOf(video);
												if (completedIndex >= 0) setActiveVideoIndex(completedIndex);
											}
										}}
										disabled={!isCompleted}
									>
										<div className="flex items-center gap-[var(--space-2)]">
											<div className={`w-2 h-2 rounded-full ${
												video.status === 'completed' ? 'bg-[var(--success-500)]' :
												video.status === 'processing' ? 'bg-[var(--warning-600)] animate-pulse' :
												video.status === 'failed' ? 'bg-[var(--danger-500)]' :
												'bg-[var(--border-secondary)]'
											}`} />
											<span className="truncate">{video.sceneName}</span>
										</div>
										<div className="text-xs text-[var(--text-tertiary)]">
											{video.status === 'completed' && '✓'}
											{video.status === 'processing' && '⏳'}
											{video.status === 'failed' && '✗'}
											{video.status === 'pending' && '⏸'}
										</div>
									</Button>
								);
							})}
						</div>
						<div className="mt-[var(--space-2)] pt-[var(--space-2)] border-t border-[var(--border-primary)] text-xs text-[var(--text-tertiary)]">
							{processingVideos.length > 0 && (<div>⏳ {processingVideos.length} processing...</div>)}
							{failedVideos.length > 0 && (<div className="text-[var(--danger-500)]">✗ {failedVideos.length} failed</div>)}
							{completedVideos.length > 0 && (<div className="text-[var(--success-500)]">✓ {completedVideos.length} completed</div>)}
						</div>
					</div>
				</div>
			)}

			{/* Pending states if nothing completed yet */}
			{(hasMultipleVideos && completedVideos.length === 0) && (
				<div className="bg-[var(--surface-1)] rounded-[var(--radius-md)] border border-[var(--border-primary)] p-[var(--space-4)] text-center">
					<div className="text-[var(--text-tertiary)] text-sm mb-[var(--space-2)]">
						{processingVideos.length > 0 ? 'Processing videos...' : 'Waiting for videos...'}
					</div>
					<div className="flex justify-center">
						<div className="w-4 h-4 bg-[var(--accent-primary)] rounded-full animate-pulse" />
					</div>
				</div>
			)}

			{(hasMultipleImages && completedImages.length === 0) && (
				<div className="bg-[var(--surface-1)] rounded-[var(--radius-md)] border border-[var(--border-primary)] p-[var(--space-4)] text-center">
					<div className="text-[var(--text-tertiary)] text-sm mb-[var(--space-2)]">
						{processingImages.length > 0 ? 'Processing images...' : 'Waiting for images...'}
					</div>
					<div className="flex justify-center">
						<div className="w-4 h-4 bg-[var(--accent-primary)] rounded-full animate-pulse" />
					</div>
				</div>
			)}
		</div>
	);
}


