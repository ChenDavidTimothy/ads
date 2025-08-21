// src/components/workspace/flow/components/preview-panel.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Save, Download, Play, Image as ImageIcon } from 'lucide-react';
import { api } from '@/trpc/react';
import { useNotifications } from '@/hooks/use-notifications';

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  renderJobId?: string; // NEW: For save functionality
}

interface ImageJob {
  jobId: string;
  frameName: string;
  frameId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
  renderJobId?: string; // NEW: For save functionality
}

interface SaveButtonProps {
  renderJobId?: string;
  contentUrl?: string;
  contentName: string;
  onSaveSuccess?: () => void;
}

function SaveToAssetsButton({ renderJobId, contentName, onSaveSuccess }: SaveButtonProps) {
  const { toast } = useNotifications();
  const utils = api.useUtils();
  
  const saveToAssets = api.assets.moveToAssets.useMutation({
    onSuccess: (data) => {
      toast.success('Saved to Assets', data.message);
      // Refresh assets list to show the new asset
      void utils.assets.list.invalidate();
      void utils.assets.getQuota.invalidate();
      onSaveSuccess?.();
    },
    onError: (error) => {
      toast.error('Save Failed', error.message);
    },
  });

  // Find renderJobId from contentUrl if not provided directly
  const handleSave = () => {
    if (renderJobId) {
      saveToAssets.mutate({
        renderJobId,
        originalName: contentName,
        metadata: { saved_from: 'preview_panel' }
      });
    } else {
      toast.error('Save Failed', 'Unable to identify content source');
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={saveToAssets.isPending}
      variant="glass"
      size="sm"
      className="flex items-center gap-[var(--space-1)] text-refined"
    >
      <Save size={12} />
      {saveToAssets.isPending ? 'Saving...' : 'Save to Assets'}
    </Button>
  );
}

interface PreviewPanelProps {
  // Video content
  videoUrl: string | null;
  videos: VideoJob[];
  onDownloadVideo?: (jobId: string) => void;
  onDownloadAll?: () => void;
  
  // Image content  
  imageUrl?: string | null;
  images?: ImageJob[];
  onDownloadImage?: (jobId: string) => void;
  onDownloadAllImages?: () => void;
}

export function PreviewPanel({ 
  videoUrl, 
  videos, 
  onDownloadVideo, 
  onDownloadAll,
  imageUrl,
  images = [],
  onDownloadImage,
  onDownloadAllImages
}: PreviewPanelProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const hasMultipleVideos = videos.length > 0;
  const completedVideos = videos.filter(v => v.status === 'completed' && v.videoUrl);
  const hasSingleImage = Boolean(imageUrl);
  const hasMultipleImages = images.length > 0;
  const completedImages = images.filter(i => i.status === 'completed' && i.imageUrl);

  const activeVideo = completedVideos[activeVideoIndex];
  const processingVideos = videos.filter(v => v.status === 'processing' || v.status === 'pending');
  const failedVideos = videos.filter(v => v.status === 'failed');

  const activeImage = completedImages[activeImageIndex];
  const processingImages = images.filter(i => i.status === 'processing' || i.status === 'pending');
  const failedImages = images.filter(i => i.status === 'failed');

  // If nothing to show
  if (!hasMultipleVideos && !videoUrl && !hasSingleImage && !hasMultipleImages) {
    return (
      <div className="text-center py-[var(--space-8)] text-[var(--text-tertiary)]">
        <div className="text-sm text-refined mb-[var(--space-2)]">No preview available</div>
        <div className="text-xs text-refined">Generate content to see preview</div>
      </div>
    );
  }

  // Single video mode (legacy) - This is the key working logic from VideoPreview
  if (!hasMultipleVideos && videoUrl && !hasSingleImage && !hasMultipleImages) {
    return (
      <div className="space-y-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-3)]">
          <Play size={16} className="text-[var(--accent-primary)]" />
          <div className="text-sm text-refined-medium text-[var(--text-secondary)]">Video Preview</div>
        </div>
        <video
          src={videoUrl}
          controls
          autoPlay
          loop
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-0)]"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Single Image Preview */}
      {hasSingleImage && !hasMultipleImages && (
        <div className="space-y-[var(--space-3)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-2)]">
              <ImageIcon size={16} className="text-[var(--accent-primary)]" />
              <div className="text-sm text-refined-medium text-[var(--text-secondary)]">
                Image Preview
              </div>
            </div>
            <SaveToAssetsButton
              contentUrl={imageUrl!}
              contentName={`Generated_Image_${Date.now()}`}
              renderJobId={undefined} // We'll implement this
            />
          </div>
          <Image
            src={imageUrl!}
            alt="Generated"
            width={800}
            height={600}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-0)]"
          />
        </div>
      )}

      {/* Multi-image mode */}
      {hasMultipleImages && (
        <div className="space-y-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-2)]">
              <ImageIcon size={16} className="text-[var(--accent-primary)]" />
              <div className="text-sm text-refined-medium text-[var(--text-secondary)]">
                Images ({completedImages.length}/{images.length} ready)
              </div>
            </div>
            {onDownloadAllImages && completedImages.length > 1 && (
              <Button onClick={onDownloadAllImages} variant="glass" size="sm" className="text-refined text-[var(--text-primary)] hover:text-[var(--accent-primary)]">
                <Download size={12} className="mr-[var(--space-1)]" />
                Download All
              </Button>
            )}
          </div>

          {activeImage ? (
            <Image
              src={activeImage.imageUrl!}
              alt={activeImage.frameName}
              width={800}
              height={600}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-0)]"
            />
          ) : (
            <div className="w-full h-32 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] text-refined">
              Waiting for images...
            </div>
          )}

          {/* Image selection tabs */}
          <div className="space-y-[var(--space-2)]">
            {images.map((img, _index) => {
              const isCompleted = img.status === 'completed' && img.imageUrl;
              const isActive = isCompleted && completedImages.indexOf(img) === activeImageIndex;
              return (
                <div
                  key={img.jobId}
                  className={`group flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-sm)] border cursor-pointer transition-all duration-[var(--duration-fast)] ${
                    isActive
                      ? 'bg-[var(--accent-primary)] text-[var(--text-primary)] border-[var(--accent-primary)] shadow-glass'
                      : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                  } ${!isCompleted ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (isCompleted) {
                      const idx = completedImages.indexOf(img);
                      if (idx >= 0) setActiveImageIndex(idx);
                    }
                  }}
                >
                  <div className="flex items-center gap-[var(--space-3)] flex-1 min-w-0">
                    <div className={`w-3 h-3 rounded-full transition-colors ${
                      img.status === 'completed' ? 'bg-[var(--success-500)]' :
                      img.status === 'processing' ? 'bg-[var(--warning-600)] animate-pulse' :
                      img.status === 'failed' ? 'bg-[var(--danger-500)]' :
                      'bg-[var(--border-secondary)]'
                    }`} />
                    <span className="truncate text-refined text-[var(--text-primary)]">{img.frameName}</span>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    {/* Save button */}
                    {img.status === 'completed' && img.imageUrl && (
                      <SaveToAssetsButton
                        renderJobId={img.renderJobId}
                        contentUrl={img.imageUrl}
                        contentName={img.frameName}
                      />
                    )}

                    {/* Download button */}
                    {onDownloadImage && img.status === 'completed' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadImage(img.jobId);
                        }}
                        variant="glass"
                        size="xs"
                        className="text-[var(--text-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--surface-interactive)]"
                      >
                        <Download size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status summary */}
          <div className="text-xs text-refined pt-[var(--space-3)] border-t border-[var(--border-primary)] space-y-[var(--space-1)]">
            {processingImages.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--warning-600)]">
                <div className="w-2 h-2 bg-[var(--warning-600)] rounded-full animate-pulse" />
                <span>{processingImages.length} processing...</span>
              </div>
            )}
            {failedImages.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--danger-500)]">
                <div className="w-2 h-2 bg-[var(--danger-500)] rounded-full" />
                <span>{failedImages.length} failed</span>
              </div>
            )}
            {completedImages.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--success-500)]">
                <div className="w-2 h-2 bg-[var(--success-500)] rounded-full" />
                <span>{completedImages.length} completed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi-video mode - Enhanced from legacy VideoPreview */}
      {hasMultipleVideos && (
        <div className="space-y-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-2)]">
              <Play size={16} className="text-[var(--accent-primary)]" />
              <div className="text-sm text-refined-medium text-[var(--text-secondary)]">
                Videos ({completedVideos.length}/{videos.length} ready)
              </div>
            </div>
            {onDownloadAll && completedVideos.length > 1 && (
              <Button onClick={onDownloadAll} variant="glass" size="sm" className="text-refined text-[var(--text-primary)] hover:text-[var(--accent-primary)]">
                <Download size={12} className="mr-[var(--space-1)]" />
                Download All
              </Button>
            )}
          </div>

          {activeVideo ? (
            <div className="space-y-[var(--space-2)]">
              <div className="text-sm text-refined text-[var(--text-secondary)]">
                {activeVideo.sceneName}
              </div>
              <video
                src={activeVideo.videoUrl}
                controls
                autoPlay
                loop
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-0)]"
                key={activeVideo.jobId}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="w-full h-32 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] text-refined">
              {processingVideos.length > 0 ? 'Processing videos...' : 'Waiting for videos...'}
            </div>
          )}

          {/* Video selection tabs - Enhanced from legacy VideoPreview */}
          <div className="space-y-[var(--space-2)]">
            {videos.map((video, _index) => {
              const isCompleted = video.status === 'completed' && video.videoUrl;
              const isActive = isCompleted && completedVideos.indexOf(video) === activeVideoIndex;
              return (
                <div
                  key={video.jobId}
                  className={`group flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-sm)] border cursor-pointer transition-all duration-[var(--duration-fast)] ${
                    isActive
                      ? 'bg-[var(--accent-primary)] text-[var(--text-primary)] border-[var(--accent-primary)] shadow-glass'
                      : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                  } ${!isCompleted ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (isCompleted) {
                      const idx = completedVideos.indexOf(video);
                      if (idx >= 0) setActiveVideoIndex(idx);
                    }
                  }}
                >
                  <div className="flex items-center gap-[var(--space-3)] flex-1 min-w-0">
                    <div className={`w-3 h-3 rounded-full transition-colors ${
                      video.status === 'completed' ? 'bg-[var(--success-500)]' :
                      video.status === 'processing' ? 'bg-[var(--warning-600)] animate-pulse' :
                      video.status === 'failed' ? 'bg-[var(--danger-500)]' :
                      'bg-[var(--border-secondary)]'
                    }`} />
                    <span className="truncate text-refined text-[var(--text-primary)]">{video.sceneName}</span>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    {/* Save button */}
                    {video.status === 'completed' && video.videoUrl && (
                      <SaveToAssetsButton
                        renderJobId={video.renderJobId}
                        contentUrl={video.videoUrl}
                        contentName={video.sceneName}
                      />
                    )}

                    {/* Download button */}
                    {onDownloadVideo && video.status === 'completed' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadVideo(video.jobId);
                        }}
                        variant="glass"
                        size="xs"
                        className="text-[var(--text-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--surface-interactive)]"
                      >
                        <Download size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status summary */}
          <div className="text-xs text-refined pt-[var(--space-3)] border-t border-[var(--border-primary)] space-y-[var(--space-1)]">
            {processingVideos.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--warning-600)]">
                <div className="w-2 h-2 bg-[var(--warning-600)] rounded-full animate-pulse" />
                <span>{processingVideos.length} processing...</span>
              </div>
            )}
            {failedVideos.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--danger-500)]">
                <div className="w-2 h-2 bg-[var(--danger-500)] rounded-full" />
                <span>{failedVideos.length} failed</span>
              </div>
            )}
            {completedVideos.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--success-500)]">
                <div className="w-2 h-2 bg-[var(--success-500)] rounded-full" />
                <span>{completedVideos.length} completed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending states if nothing completed yet - From legacy VideoPreview */}
      {(hasMultipleVideos && completedVideos.length === 0) && (
        <div className="bg-[var(--surface-1)] rounded-[var(--radius-md)] border border-[var(--border-primary)] p-[var(--space-6)] text-center">
          <div className="text-[var(--text-tertiary)] text-refined mb-[var(--space-3)]">
            {processingVideos.length > 0 ? 'Processing videos...' : 'Waiting for videos...'}
          </div>
          <div className="flex justify-center">
            <div className="w-6 h-6 bg-[var(--accent-primary)] rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {(hasMultipleImages && completedImages.length === 0) && (
        <div className="bg-[var(--surface-1)] rounded-[var(--radius-md)] border border-[var(--border-primary)] p-[var(--space-6)] text-center">
          <div className="text-[var(--text-tertiary)] text-refined mb-[var(--space-3)]">
            {processingImages.length > 0 ? 'Processing images...' : 'Waiting for images...'}
          </div>
          <div className="flex justify-center">
            <div className="w-6 h-6 bg-[var(--accent-primary)] rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
