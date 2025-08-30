// src/components/workspace/flow/components/preview-panel.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Save,
  Download,
  Play,
  Image as ImageIcon,
  Archive,
} from "lucide-react";
import { api } from "@/trpc/react";
import { useNotifications } from "@/hooks/use-notifications";
import { usePreviewDownloads } from "@/hooks/use-preview-downloads";

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
  renderJobId?: string; // NEW: For save functionality
}

interface ImageJob {
  jobId: string;
  frameName: string;
  frameId: string;
  status: "pending" | "processing" | "completed" | "failed";
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

function SaveToAssetsButton({
  renderJobId,
  contentName,
  onSaveSuccess,
}: SaveButtonProps) {
  const { toast } = useNotifications();
  const utils = api.useUtils();

  const saveToAssets = api.assets.moveToAssets.useMutation({
    onSuccess: (data) => {
      toast.success("Saved to Assets", data.message);
      // Refresh assets list to show the new asset
      void utils.assets.list.invalidate();
      void utils.assets.getQuota.invalidate();
      onSaveSuccess?.();
    },
    onError: (error) => {
      toast.error("Save Failed", error.message);
    },
  });

  // Find renderJobId from contentUrl if not provided directly
  const handleSave = () => {
    if (renderJobId) {
      saveToAssets.mutate({
        renderJobId,
        originalName: contentName,
        metadata: { saved_from: "preview_panel" },
      });
    } else {
      toast.error("Save Failed", "Unable to identify content source");
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={saveToAssets.isPending}
      variant="glass"
      size="sm"
      className="text-refined flex items-center gap-[var(--space-1)]"
    >
      <Save size={12} />
      {saveToAssets.isPending ? "Saving..." : "Save to Assets"}
    </Button>
  );
}

interface PreviewPanelProps {
  // Video content
  videoUrl: string | null;
  videos: VideoJob[];

  // Image content
  imageUrl?: string | null;
  images?: ImageJob[];
}

export function PreviewPanel({
  videoUrl,
  videos,
  imageUrl,
  images = [],
}: PreviewPanelProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Use the download hook for robust download functionality
  const {
    downloadVideo,
    downloadImage,
    downloadAllVideos,
    downloadAllImages,
    isDownloading,
    downloadProgress,
    currentFile,
  } = usePreviewDownloads({ videos, images });

  const hasMultipleVideos = videos.length > 0;
  const completedVideos = videos.filter(
    (v) => v.status === "completed" && v.videoUrl,
  );
  const hasSingleImage = Boolean(imageUrl);
  const hasMultipleImages = images.length > 0;
  const completedImages = images.filter(
    (i) => i.status === "completed" && i.imageUrl,
  );

  const activeVideo = completedVideos[activeVideoIndex];
  const processingVideos = videos.filter(
    (v) => v.status === "processing" || v.status === "pending",
  );
  const failedVideos = videos.filter((v) => v.status === "failed");

  const activeImage = completedImages[activeImageIndex];
  const processingImages = images.filter(
    (i) => i.status === "processing" || i.status === "pending",
  );
  const failedImages = images.filter((i) => i.status === "failed");

  // If nothing to show
  if (
    !hasMultipleVideos &&
    !videoUrl &&
    !hasSingleImage &&
    !hasMultipleImages
  ) {
    return (
      <div className="py-[var(--space-8)] text-center text-[var(--text-tertiary)]">
        <div className="text-refined mb-[var(--space-2)] text-sm">
          No preview available
        </div>
        <div className="text-refined text-xs">
          Generate content to see preview
        </div>
      </div>
    );
  }

  // Single video mode (legacy) - This is the key working logic from VideoPreview
  if (!hasMultipleVideos && videoUrl && !hasSingleImage && !hasMultipleImages) {
    return (
      <div className="space-y-[var(--space-4)]">
        <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
          <Play size={16} className="text-[var(--accent-primary)]" />
          <div className="text-refined-medium text-sm text-[var(--text-secondary)]">
            Video Preview
          </div>
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
      {/* Download Progress Indicator */}
      {isDownloading && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-4)]">
          <div className="mb-[var(--space-2)] flex items-center justify-between">
            <div className="text-refined-medium text-sm text-[var(--text-secondary)]">
              Downloading...
            </div>
            <div className="text-refined text-xs text-[var(--text-tertiary)]">
              {downloadProgress}%
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--surface-2)]">
            <div
              className="h-2 rounded-full bg-[var(--accent-primary)] transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          {currentFile && (
            <div className="text-refined mt-[var(--space-1)] truncate text-xs text-[var(--text-tertiary)]">
              {currentFile}
            </div>
          )}
        </div>
      )}

      {/* Single Image Preview */}
      {hasSingleImage && !hasMultipleImages && (
        <div className="space-y-[var(--space-3)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-2)]">
              <ImageIcon size={16} className="text-[var(--accent-primary)]" />
              <div className="text-refined-medium text-sm text-[var(--text-secondary)]">
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
              <div className="text-refined-medium text-sm text-[var(--text-secondary)]">
                Images ({completedImages.length}/{images.length} ready)
              </div>
            </div>
            {completedImages.length > 1 && (
              <Button
                onClick={downloadAllImages}
                disabled={isDownloading}
                variant="glass"
                size="sm"
                className="text-refined text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
              >
                <Archive size={12} className="mr-[var(--space-1)]" />
                {isDownloading ? "Downloading..." : "Download All"}
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
            <div className="text-refined flex h-32 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-2)] text-[var(--text-tertiary)]">
              Waiting for images...
            </div>
          )}

          {/* Image selection tabs */}
          <div className="space-y-[var(--space-2)]">
            {images.map((img, _index) => {
              const isCompleted = img.status === "completed" && img.imageUrl;
              const isActive =
                isCompleted &&
                completedImages.indexOf(img) === activeImageIndex;
              return (
                <div
                  key={img.jobId}
                  className={`group flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] border p-[var(--space-3)] transition-all duration-[var(--duration-fast)] ${
                    isActive
                      ? "shadow-glass border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-primary)]"
                      : "border-[var(--border-primary)] bg-[var(--surface-1)] hover:border-[var(--border-secondary)] hover:bg-[var(--surface-2)]"
                  } ${!isCompleted ? "cursor-not-allowed opacity-60" : ""}`}
                  onClick={() => {
                    if (isCompleted) {
                      const idx = completedImages.indexOf(img);
                      if (idx >= 0) setActiveImageIndex(idx);
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-[var(--space-3)]">
                    <div
                      className={`h-3 w-3 rounded-full transition-colors ${
                        img.status === "completed"
                          ? "bg-[var(--success-500)]"
                          : img.status === "processing"
                            ? "animate-pulse bg-[var(--warning-600)]"
                            : img.status === "failed"
                              ? "bg-[var(--danger-500)]"
                              : "bg-[var(--border-secondary)]"
                      }`}
                    />
                    <span className="text-refined truncate text-[var(--text-primary)]">
                      {img.frameName}
                    </span>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    {/* Save button */}
                    {img.status === "completed" && img.imageUrl && (
                      <SaveToAssetsButton
                        renderJobId={img.renderJobId}
                        contentUrl={img.imageUrl}
                        contentName={img.frameName}
                      />
                    )}

                    {/* Download button */}
                    {img.status === "completed" && img.imageUrl && (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void downloadImage(img.jobId);
                        }}
                        variant="glass"
                        size="xs"
                        disabled={isDownloading}
                        className="text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] hover:text-[var(--accent-primary)]"
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
          <div className="text-refined space-y-[var(--space-1)] border-t border-[var(--border-primary)] pt-[var(--space-3)] text-xs">
            {processingImages.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--warning-600)]">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--warning-600)]" />
                <span>{processingImages.length} processing...</span>
              </div>
            )}
            {failedImages.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--danger-500)]">
                <div className="h-2 w-2 rounded-full bg-[var(--danger-500)]" />
                <span>{failedImages.length} failed</span>
              </div>
            )}
            {completedImages.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--success-500)]">
                <div className="h-2 w-2 rounded-full bg-[var(--success-500)]" />
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
              <div className="text-refined-medium text-sm text-[var(--text-secondary)]">
                Videos ({completedVideos.length}/{videos.length} ready)
              </div>
            </div>
            {completedVideos.length > 1 && (
              <Button
                onClick={downloadAllVideos}
                disabled={isDownloading}
                variant="glass"
                size="sm"
                className="text-refined text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
              >
                <Archive size={12} className="mr-[var(--space-1)]" />
                {isDownloading ? "Downloading..." : "Download All"}
              </Button>
            )}
          </div>

          {activeVideo ? (
            <div className="space-y-[var(--space-2)]">
              <div className="text-refined text-sm text-[var(--text-secondary)]">
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
            <div className="text-refined flex h-32 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-2)] text-[var(--text-tertiary)]">
              {processingVideos.length > 0
                ? "Processing videos..."
                : "Waiting for videos..."}
            </div>
          )}

          {/* Video selection tabs - Enhanced from legacy VideoPreview */}
          <div className="space-y-[var(--space-2)]">
            {videos.map((video, _index) => {
              const isCompleted =
                video.status === "completed" && video.videoUrl;
              const isActive =
                isCompleted &&
                completedVideos.indexOf(video) === activeVideoIndex;
              return (
                <div
                  key={video.jobId}
                  className={`group flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] border p-[var(--space-3)] transition-all duration-[var(--duration-fast)] ${
                    isActive
                      ? "shadow-glass border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-primary)]"
                      : "border-[var(--border-primary)] bg-[var(--surface-1)] hover:border-[var(--border-secondary)] hover:bg-[var(--surface-2)]"
                  } ${!isCompleted ? "cursor-not-allowed opacity-60" : ""}`}
                  onClick={() => {
                    if (isCompleted) {
                      const idx = completedVideos.indexOf(video);
                      if (idx >= 0) setActiveVideoIndex(idx);
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-[var(--space-3)]">
                    <div
                      className={`h-3 w-3 rounded-full transition-colors ${
                        video.status === "completed"
                          ? "bg-[var(--success-500)]"
                          : video.status === "processing"
                            ? "animate-pulse bg-[var(--warning-600)]"
                            : video.status === "failed"
                              ? "bg-[var(--danger-500)]"
                              : "bg-[var(--border-secondary)]"
                      }`}
                    />
                    <span className="text-refined truncate text-[var(--text-primary)]">
                      {video.sceneName}
                    </span>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    {/* Save button */}
                    {video.status === "completed" && video.videoUrl && (
                      <SaveToAssetsButton
                        renderJobId={video.renderJobId}
                        contentUrl={video.videoUrl}
                        contentName={video.sceneName}
                      />
                    )}

                    {/* Download button */}
                    {video.status === "completed" && video.videoUrl && (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void downloadVideo(video.jobId);
                        }}
                        variant="glass"
                        size="xs"
                        disabled={isDownloading}
                        className="text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] hover:text-[var(--accent-primary)]"
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
          <div className="text-refined space-y-[var(--space-1)] border-t border-[var(--border-primary)] pt-[var(--space-3)] text-xs">
            {processingVideos.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--warning-600)]">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--warning-600)]" />
                <span>{processingVideos.length} processing...</span>
              </div>
            )}
            {failedVideos.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--danger-500)]">
                <div className="h-2 w-2 rounded-full bg-[var(--danger-500)]" />
                <span>{failedVideos.length} failed</span>
              </div>
            )}
            {completedVideos.length > 0 && (
              <div className="flex items-center gap-[var(--space-2)] text-[var(--success-500)]">
                <div className="h-2 w-2 rounded-full bg-[var(--success-500)]" />
                <span>{completedVideos.length} completed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending states if nothing completed yet - From legacy VideoPreview */}
      {hasMultipleVideos && completedVideos.length === 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-6)] text-center">
          <div className="text-refined mb-[var(--space-3)] text-[var(--text-tertiary)]">
            {processingVideos.length > 0
              ? "Processing videos..."
              : "Waiting for videos..."}
          </div>
          <div className="flex justify-center">
            <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--accent-primary)]" />
          </div>
        </div>
      )}

      {hasMultipleImages && completedImages.length === 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-6)] text-center">
          <div className="text-refined mb-[var(--space-3)] text-[var(--text-tertiary)]">
            {processingImages.length > 0
              ? "Processing images..."
              : "Waiting for images..."}
          </div>
          <div className="flex justify-center">
            <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--accent-primary)]" />
          </div>
        </div>
      )}
    </div>
  );
}
