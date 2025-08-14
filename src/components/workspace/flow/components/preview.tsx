"use client";

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
	videoUrl: string | null;
	videos: VideoJob[];
	onDownloadVideo?: (jobId: string) => void;
	onDownloadAll?: () => void;
	imageUrl?: string | null;
	images?: ImageJob[];
	onDownloadImage?: (jobId: string) => void;
	onDownloadAllImages?: () => void;
	docked?: boolean;
	onClose?: () => void;
	activeTab?: 'video' | 'image';
	onTabChange?: (tab: 'video' | 'image') => void;
}

export function VideoPreview({ videoUrl, videos, imageUrl, images = [], docked = true, onClose, activeTab = 'video', onTabChange, onDownloadVideo, onDownloadAll, onDownloadImage, onDownloadAllImages }: Props) {
	const containerClasses = docked
		? 'w-full bg-[var(--surface-1)] border-t border-[var(--border-primary)]'
		: 'absolute bottom-[var(--space-4)] right-[var(--space-4)] w-96';

	const hasAnyVideo = Boolean(videoUrl) || videos.some(v => v.status === 'completed' && v.videoUrl);
	const hasAnyImage = Boolean(imageUrl) || images.some(i => i.status === 'completed' && i.imageUrl);
	if (!hasAnyVideo && !hasAnyImage) return null;

	return (
		<div className={containerClasses}>
			<div className={`flex items-center justify-between ${docked ? 'px-[var(--space-3)] py-[var(--space-2)]' : ''} bg-[var(--surface-2)] border-b border-[var(--border-primary)]`}>
				<div className="flex items-center gap-[var(--space-2)]">
					<Button variant={activeTab === 'video' ? 'primary' : 'ghost'} size="sm" onClick={() => onTabChange && onTabChange('video')}>Video</Button>
					<Button variant={activeTab === 'image' ? 'primary' : 'ghost'} size="sm" onClick={() => onTabChange && onTabChange('image')}>Image</Button>
				</div>
				{onClose ? (<Button onClick={onClose} variant="ghost" size="sm"><X size={14} /></Button>) : null}
			</div>
			<div className={`${docked ? 'p-[var(--space-3)]' : ''}`}>
				{activeTab === 'video' ? (
					<div className="rounded-[var(--radius-md)] overflow-hidden">
						{videoUrl ? (
							<video src={videoUrl} controls autoPlay loop className="w-full" />
						) : (
							<div className="p-[var(--space-4)] text-center text-[var(--text-tertiary)] text-sm">No video yet</div>
						)}
						{onDownloadAll && videos.filter(v => v.status === 'completed' && v.videoUrl).length > 1 ? (
							<Button onClick={onDownloadAll} variant="primary" size="sm" className="text-xs mt-[var(--space-2)]">Download All</Button>
						) : null}
					</div>
				) : (
					<div className="rounded-[var(--radius-md)] overflow-hidden">
						{imageUrl ? (
							<img src={imageUrl} alt="Generated" className="w-full" />
						) : (
							<div className="p-[var(--space-4)] text-center text-[var(--text-tertiary)] text-sm">No image yet</div>
						)}
						{onDownloadAllImages && images.filter(i => i.status === 'completed' && i.imageUrl).length > 1 ? (
							<Button onClick={onDownloadAllImages} variant="primary" size="sm" className="text-xs mt-[var(--space-2)]">Download All</Button>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}


