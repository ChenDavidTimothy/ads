import { useState, useCallback } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import JSZip from "jszip";

/**
 * Simple download function using native browser APIs
 */
async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(blobUrl);
}

/**
 * Generate a safe filename with timestamp
 */
function generateSafeFilename(baseName: string, extension = ""): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeName = baseName
    .replace(/[\\\/\0\n\r\t\f\v:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeName}_${timestamp}${extension}`;
}

/**
 * Download multiple files as ZIP
 */
async function downloadFilesAsZip(
  files: Array<{ url: string; filename: string }>,
  zipFilename: string
): Promise<void> {
  const zip = new JSZip();

  // Download all files and add to ZIP
  const downloadPromises = files.map(async (file) => {
    const response = await fetch(file.url);
    const blob = await response.blob();
    zip.file(file.filename, blob);
  });

  await Promise.all(downloadPromises);

  // Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipUrl = URL.createObjectURL(zipBlob);

  const link = document.createElement("a");
  link.href = zipUrl;
  link.download = zipFilename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(zipUrl);
}

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

interface ImageJob {
  jobId: string;
  frameName: string;
  frameId: string;
  status: "pending" | "processing" | "completed" | "failed";
  imageUrl?: string;
  error?: string;
}

interface UsePreviewDownloadsProps {
  videos?: VideoJob[];
  images?: ImageJob[];
}

export function usePreviewDownloads({
  videos = [],
  images = [],
}: UsePreviewDownloadsProps) {
  const { toast } = useNotifications();
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");

  const downloadVideo = useCallback(
    async (jobId: string) => {
      const video = videos.find((v) => v.jobId === jobId);
      if (!video?.videoUrl) {
        toast.error("Download Failed", "Video not available");
        return;
      }

      setIsDownloading(true);
      setDownloadProgress(0);
      setCurrentFile(video.sceneName);

      try {
        await downloadFile(video.videoUrl, `${video.sceneName}.mp4`);
        toast.success(
          "Download Complete",
          `${video.sceneName} has been downloaded`,
        );
      } catch (error) {
        toast.error("Download Failed", error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsDownloading(false);
      }
    },
    [videos, toast],
  );

  const downloadImage = useCallback(
    async (jobId: string) => {
      const image = images.find((i) => i.jobId === jobId);

      if (!image?.imageUrl) {
        toast.error("Download Failed", "Image not available");
        return;
      }

      setIsDownloading(true);
      setDownloadProgress(0);
      setCurrentFile(image.frameName);

      try {
        await downloadFile(image.imageUrl, `${image.frameName}.png`);
        toast.success(
          "Download Complete",
          `${image.frameName} has been downloaded`,
        );
      } catch (error) {
        toast.error("Download Failed", error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsDownloading(false);
      }
    },
    [images, toast],
  );

  const downloadAllVideos = useCallback(async () => {
    const completedVideos = videos.filter(
      (v) => v.status === "completed" && v.videoUrl,
    );
    if (completedVideos.length === 0) {
      toast.error("Download Failed", "No completed videos to download");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    const files = completedVideos.map((video) => ({
      url: video.videoUrl!,
      filename: `${video.sceneName}.mp4`,
    }));

    try {
      await downloadFilesAsZip(files, generateSafeFilename("videos", ".zip"));
      toast.success(
        "Download Complete",
        `All ${completedVideos.length} videos have been downloaded as ZIP`,
      );
    } catch (error) {
      toast.error("Download Failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsDownloading(false);
    }
  }, [videos, toast]);

  const downloadAllImages = useCallback(async () => {
    const completedImages = images.filter(
      (i) => i.status === "completed" && i.imageUrl,
    );
    if (completedImages.length === 0) {
      toast.error("Download Failed", "No completed images to download");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    const files = completedImages.map((image) => ({
      url: image.imageUrl!,
      filename: `${image.frameName}.png`,
    }));

    try {
      await downloadFilesAsZip(files, generateSafeFilename("images", ".zip"));
      toast.success(
        "Download Complete",
        `All ${completedImages.length} images have been downloaded as ZIP`,
      );
    } catch (error) {
      toast.error("Download Failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsDownloading(false);
    }
  }, [images, toast]);

  const downloadAllContent = useCallback(async () => {
    const completedVideos = videos.filter(
      (v) => v.status === "completed" && v.videoUrl,
    );
    const completedImages = images.filter(
      (i) => i.status === "completed" && i.imageUrl,
    );

    if (completedVideos.length === 0 && completedImages.length === 0) {
      toast.error("Download Failed", "No completed content to download");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    const allFiles = [
      ...completedVideos.map((video) => ({
        url: video.videoUrl!,
        filename: `videos/${video.sceneName}.mp4`,
      })),
      ...completedImages.map((image) => ({
        url: image.imageUrl!,
        filename: `images/${image.frameName}.png`,
      })),
    ];

    try {
      await downloadFilesAsZip(allFiles, generateSafeFilename("all_content", ".zip"));
      toast.success(
        "Download Complete",
        `All content (${allFiles.length} files) has been downloaded as ZIP`,
      );
    } catch (error) {
      toast.error("Download Failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsDownloading(false);
    }
  }, [videos, images, toast]);

  return {
    downloadVideo,
    downloadImage,
    downloadAllVideos,
    downloadAllImages,
    downloadAllContent,
    isDownloading,
    downloadProgress,
    currentFile,
  };
}
