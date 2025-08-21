import { useState, useCallback } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import {
  downloadFile,
  downloadFilesAsZip,
  type DownloadableFile,
  generateSafeFilename,
} from "@/utils/download-utils";

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
        await downloadFile(
          {
            url: video.videoUrl,
            filename: `${video.sceneName}.mp4`,
            mimeType: "video/mp4",
          },
          {
            onProgress: (progress) => setDownloadProgress(progress),
            onComplete: () => {
              toast.success(
                "Download Complete",
                `${video.sceneName} has been downloaded`,
              );
              setDownloadProgress(0);
              setCurrentFile("");
            },
            onError: (error) => {
              toast.error("Download Failed", error);
            },
            timeout: 120000, // 2 minutes for videos
          },
        );
      } catch {
        // Error handling is done in callbacks
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
        await downloadFile(
          {
            url: image.imageUrl,
            filename: `${image.frameName}.png`,
            mimeType: "image/png",
          },
          {
            onProgress: (progress) => setDownloadProgress(progress),
            onComplete: () => {
              toast.success(
                "Download Complete",
                `${image.frameName} has been downloaded`,
              );
              setDownloadProgress(0);
              setCurrentFile("");
            },
            onError: (error) => {
              toast.error("Download Failed", error);
            },
            timeout: 30000, // 30 seconds for images
          },
        );
      } catch {
        // Error handling is done in callbacks
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

    const files: DownloadableFile[] = completedVideos.map((video) => ({
      url: video.videoUrl!,
      filename: `${video.sceneName}.mp4`,
      mimeType: "video/mp4",
    }));

    try {
      await downloadFilesAsZip(files, {
        zipFilename: generateSafeFilename("videos", ".zip"),
        compress: true,
        onProgress: (progress, file) => {
          setDownloadProgress(progress);
          if (file) setCurrentFile(file);
        },
        onComplete: () => {
          toast.success(
            "Download Complete",
            `All ${completedVideos.length} videos have been downloaded as ZIP`,
          );
          setDownloadProgress(0);
          setCurrentFile("");
        },
        onError: (error, file) => {
          toast.error("Download Failed", file ? `${file}: ${error}` : error);
        },
        timeout: 300000, // 5 minutes for batch video downloads
      });
    } catch {
      // Error handling is done in callbacks
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

    const files: DownloadableFile[] = completedImages.map((image) => ({
      url: image.imageUrl!,
      filename: `${image.frameName}.png`,
      mimeType: "image/png",
    }));

    try {
      await downloadFilesAsZip(files, {
        zipFilename: generateSafeFilename("images", ".zip"),
        compress: false, // Don't compress images as they're already compressed
        onProgress: (progress, file) => {
          setDownloadProgress(progress);
          if (file) setCurrentFile(file);
        },
        onComplete: () => {
          toast.success(
            "Download Complete",
            `All ${completedImages.length} images have been downloaded as ZIP`,
          );
          setDownloadProgress(0);
          setCurrentFile("");
        },
        onError: (error, file) => {
          toast.error("Download Failed", file ? `${file}: ${error}` : error);
        },
        timeout: 120000, // 2 minutes for batch image downloads
      });
    } catch {
      // Error handling is done in callbacks
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

    const allFiles: DownloadableFile[] = [
      ...completedVideos.map((video) => ({
        url: video.videoUrl!,
        filename: `videos/${video.sceneName}.mp4`,
        mimeType: "video/mp4",
      })),
      ...completedImages.map((image) => ({
        url: image.imageUrl!,
        filename: `images/${image.frameName}.png`,
        mimeType: "image/png",
      })),
    ];

    try {
      await downloadFilesAsZip(allFiles, {
        zipFilename: generateSafeFilename("all_content", ".zip"),
        compress: true,
        onProgress: (progress, file) => {
          setDownloadProgress(progress);
          if (file) setCurrentFile(file);
        },
        onComplete: () => {
          toast.success(
            "Download Complete",
            `All content (${allFiles.length} files) has been downloaded as ZIP`,
          );
          setDownloadProgress(0);
          setCurrentFile("");
        },
        onError: (error, file) => {
          toast.error("Download Failed", file ? `${file}: ${error}` : error);
        },
        timeout: 300000, // 5 minutes for all content
      });
    } catch {
      // Error handling is done in callbacks
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
