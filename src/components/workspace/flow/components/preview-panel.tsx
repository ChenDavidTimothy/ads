// src/components/workspace/flow/components/preview-panel.tsx
"use client";

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
      <div className="text-center py-[var(--space-6)] text-[var(--text-tertiary)]">
        <div className="text-sm">No preview available</div>
        <div className="text-xs mt-[var(--space-1)]">Generate content to see preview</div>
      </div>
    );
  }

  // Single video mode (legacy) - This is the key working logic from VideoPreview
  if (!hasMultipleVideos && videoUrl && !hasSingleImage && !hasMultipleImages) {
    return (
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-secondary)]">Video Preview</div>
        <video 
          src={videoUrl} 
          controls 
          autoPlay 
          loop 
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)]"
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
        <div>
          <div className="text-sm font-medium text-[var(--text-secondary)] mb-[var(--space-2)]">
            Image Preview
          </div>
          <img 
            src={imageUrl!} 
            alt="Generated" 
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)]" 
          />
        </div>
      )}

      {/* Multi-image mode */}
      {hasMultipleImages && (
        <div>
          <div className="flex items-center justify-between mb-[var(--space-2)]">
            <div className="text-sm font-medium text-[var(--text-secondary)]">
              Images ({completedImages.length}/{images.length} ready)
            </div>
            {onDownloadAllImages && completedImages.length > 1 && (
              <Button onClick={onDownloadAllImages} variant="primary" size="sm" className="text-xs">
                Download All
              </Button>
            )}
          </div>

          {activeImage ? (
            <img 
              src={activeImage.imageUrl} 
              alt={activeImage.frameName} 
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)] mb-[var(--space-3)]" 
            />
          ) : (
            <div className="w-full h-32 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] text-sm mb-[var(--space-3)]">
              Waiting for images...
            </div>
          )}

          {/* Image selection tabs */}
          <div className="space-y-[var(--space-1)]">
            {images.map((img, index) => {
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
                  <div className="flex items-center gap-[var(--space-1)]">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {img.status === 'completed' && '✓'}
                      {img.status === 'processing' && '⏳'}
                      {img.status === 'failed' && '✗'}
                      {img.status === 'pending' && '⏸'}
                    </span>
                    {onDownloadImage && img.status === 'completed' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadImage(img.jobId);
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        ⬇️
                      </Button>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Status summary */}
          <div className="text-xs text-[var(--text-tertiary)] pt-[var(--space-2)] border-t border-[var(--border-primary)]">
            {processingImages.length > 0 && (<div>⏳ {processingImages.length} processing...</div>)}
            {failedImages.length > 0 && (<div className="text-[var(--danger-500)]">✗ {failedImages.length} failed</div>)}
            {completedImages.length > 0 && (<div className="text-[var(--success-500)]">✓ {completedImages.length} completed</div>)}
          </div>
        </div>
      )}

      {/* Multi-video mode - Enhanced from legacy VideoPreview */}
      {hasMultipleVideos && (
        <div>
          <div className="flex items-center justify-between mb-[var(--space-2)]">
            <div className="text-sm font-medium text-[var(--text-secondary)]">
              Videos ({completedVideos.length}/{videos.length} ready)
            </div>
            {onDownloadAll && completedVideos.length > 1 && (
              <Button onClick={onDownloadAll} variant="primary" size="sm" className="text-xs">
                Download All
              </Button>
            )}
          </div>

          {activeVideo ? (
            <div className="mb-[var(--space-3)]">
              <div className="text-xs text-[var(--text-secondary)] mb-[var(--space-1)]">
                {activeVideo.sceneName}
              </div>
              <video 
                src={activeVideo.videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-primary)]"
                key={activeVideo.jobId}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="w-full h-32 bg-[var(--surface-2)] rounded-[var(--radius-md)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] text-sm mb-[var(--space-3)]">
              {processingVideos.length > 0 ? 'Processing videos...' : 'Waiting for videos...'}
            </div>
          )}

          {/* Video selection tabs - Enhanced from legacy VideoPreview */}
          <div className="space-y-[var(--space-1)]">
            {videos.map((video, index) => {
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
                      const idx = completedVideos.indexOf(video);
                      if (idx >= 0) setActiveVideoIndex(idx);
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
                  <div className="flex items-center gap-[var(--space-1)]">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {video.status === 'completed' && '✓'}
                      {video.status === 'processing' && '⏳'}
                      {video.status === 'failed' && '✗'}
                      {video.status === 'pending' && '⏸'}
                    </span>
                    {onDownloadVideo && video.status === 'completed' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadVideo(video.jobId);
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        ⬇️
                      </Button>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Status summary */}
          <div className="text-xs text-[var(--text-tertiary)] pt-[var(--space-2)] border-t border-[var(--border-primary)]">
            {processingVideos.length > 0 && (<div>⏳ {processingVideos.length} processing...</div>)}
            {failedVideos.length > 0 && (<div className="text-[var(--danger-500)]">✗ {failedVideos.length} failed</div>)}
            {completedVideos.length > 0 && (<div className="text-[var(--success-500)]">✓ {completedVideos.length} completed</div>)}
          </div>
        </div>
      )}

      {/* Pending states if nothing completed yet - From legacy VideoPreview */}
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
