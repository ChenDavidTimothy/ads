/**
 * Robust download utilities for assets and generated content
 * Supports single file downloads and ZIP compression for multiple files
 */

import JSZip from "jszip";

export interface DownloadableFile {
  url: string;
  filename: string;
  size?: number;
  mimeType?: string;
  assetId?: string; // For API-based downloads
}

export interface DownloadOptions {
  onProgress?: (progress: number, file?: string) => void;
  onComplete?: () => void;
  onError?: (error: string, file?: string) => void;
  timeout?: number; // overall timeout
  perRequestTimeout?: number; // per-fetch attempt timeout
}

export interface BatchDownloadOptions extends DownloadOptions {
  zipFilename?: string;
  compress?: boolean;
}

/**
 * Detect if a URL is a Supabase signed URL
 */
function isSupabaseSignedUrl(url: string): boolean {
  return url.includes("supabase.co") && url.includes("token=");
}

/**
 * Ensure filenames are unique inside a ZIP by appending a numeric suffix
 * Preserves any directory path (e.g. images/name.png -> images/name (2).png)
 */
function ensureUniqueZipPath(
  existing: Set<string>,
  originalPath: string,
): string {
  // Sanitize illegal characters first
  const sanitized = originalPath
    .replace(/[\\\/\0\n\r\t\f\v:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!existing.has(sanitized)) {
    existing.add(sanitized);
    return sanitized;
  }

  // Split into dir and filename
  const lastSlashIndex = sanitized.lastIndexOf("/");
  const dir = lastSlashIndex >= 0 ? sanitized.slice(0, lastSlashIndex + 1) : "";
  const name =
    lastSlashIndex >= 0 ? sanitized.slice(lastSlashIndex + 1) : sanitized;

  // Split filename into base and extension
  const lastDotIndex = name.lastIndexOf(".");
  const base = lastDotIndex >= 0 ? name.slice(0, lastDotIndex) : name;
  const ext = lastDotIndex >= 0 ? name.slice(lastDotIndex) : "";

  let counter = 2;
  while (true) {
    const candidate = `${dir}${base} (${counter})${ext}`;
    if (!existing.has(candidate)) {
      existing.add(candidate);
      return candidate;
    }
    counter++;
  }
}

/**
 * Fetch a file as Blob with resilient options and tiny retry
 */
async function fetchFileBlob(
  url: string,
  mimeType?: string,
  perRequestTimeoutMs = 45000,
): Promise<Blob> {
  const attempt = async (): Promise<Response> => {
    const isSupabase = isSupabaseSignedUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perRequestTimeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: mimeType ?? "*/*",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        mode: isSupabase ? "cors" : "cors",
        cache: "no-store",
        credentials: "omit",
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  // Basic retry: 1 retry for transient network TypeError or opaque failure
  try {
    const res = await attempt();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.blob();
  } catch {
    // Short backoff then retry once
    await new Promise((r) => setTimeout(r, 300));
    const res2 = await attempt();
    if (!res2.ok) throw new Error(`HTTP ${res2.status}: ${res2.statusText}`);
    return await res2.blob();
  }
}

/**
 * Special download function for Supabase signed URLs
 */
async function downloadSupabaseFile(
  file: DownloadableFile,
  options: DownloadOptions = {},
): Promise<void> {
  const { onComplete, onError, timeout = 90000 } = options; // ✅ CRITICAL FIX: Increased to 90s

  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      const error = "Download timeout for Supabase file";
      onError?.(error, file.filename);
      reject(new Error(error));
    }, timeout);

    fetch(file.url, {
      signal: controller.signal,
      headers: {
        Accept: file.mimeType ?? "*/*",
        // Critical for Supabase downloads
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      mode: "cors",
    })
      .then((response) => {
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.blob();
      })
      .then((blob) => {
        // Force download with special handling
        forceSupabaseDownload(blob, file.filename);
        onComplete?.();
        resolve();
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        const errorMessage =
          error instanceof Error && error.name === "AbortError"
            ? "Download was cancelled"
            : `Supabase download failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error("❌ Supabase download error:", error);
        onError?.(errorMessage, file.filename);
        reject(new Error(errorMessage));
      });
  });
}

/**
 * Force download with special handling for Supabase files
 */
function forceSupabaseDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  // Create a hidden link element with special attributes
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";

  // Set attributes that force download behavior
  link.setAttribute("download", filename);
  link.setAttribute("type", blob.type || "application/octet-stream");

  // Add to DOM temporarily
  document.body.appendChild(link);

  // Use multiple trigger methods
  setTimeout(() => {
    // Method 1: Direct click
    try {
      link.click();
    } catch (clickError) {
      console.warn("Supabase direct click failed:", clickError);

      // Method 2: Event dispatch
      try {
        const event = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        link.dispatchEvent(event);
      } catch (eventError) {
        console.warn("Supabase event dispatch failed:", eventError);

        // Method 3: Direct navigation as last resort
        try {
          window.location.href = url;
        } catch (navError) {
          console.warn("Supabase direct navigation failed:", navError);
        }
      }
    }

    // Clean up
    document.body.removeChild(link);

    // Clean up blob URL after longer delay for Supabase
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 15000);
  }, 100);
}

/**
 * Force download using multiple techniques to ensure file downloads
 */
function forceDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  // Method 1: Create and click anchor element (most compatible)
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  // Additional attributes to force download behavior
  link.setAttribute("download", filename);
  link.style.display = "none";

  // Add to DOM and click
  document.body.appendChild(link);

  // Small delay to ensure DOM attachment
  setTimeout(() => {
    // Try multiple methods to ensure download works
    let downloadAttempted = false;

    try {
      // Method 1: Programmatic click (most reliable)
      link.click();
      downloadAttempted = true;
    } catch (error) {
      console.warn("Download click failed:", error);
    }

    // Method 2: Simulate user click event (fallback)
    if (!downloadAttempted) {
      try {
        const clickEvent = new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
        });
        link.dispatchEvent(clickEvent);
        downloadAttempted = true;
      } catch (error) {
        console.warn("Download event dispatch failed:", error);
      }
    }

    // Method 3: Direct navigation (last resort for some browsers)
    if (!downloadAttempted) {
      try {
        window.location.href = url;
      } catch (error) {
        console.warn("Download direct navigation failed:", error);
      }
    }

    // Clean up link element
    document.body.removeChild(link);

    // Method 4: Iframe fallback for stubborn browsers
    // IMPORTANT: Only use this if previous methods did NOT trigger
    if (!downloadAttempted && typeof window !== "undefined") {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.style.visibility = "hidden";
        iframe.style.width = "1px";
        iframe.style.height = "1px";
        iframe.src = url;
        document.body.appendChild(iframe);

        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 2000);
      } catch (iframeError) {
        console.warn("Iframe download fallback failed:", iframeError);
      }
    }

    // Clean up the object URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10000);
  }, 100);
}

/**
 * Download a single file with proper error handling and progress tracking
 */
export async function downloadFile(
  file: DownloadableFile,
  options: DownloadOptions = {},
): Promise<void> {
  const {
    onProgress,
    onComplete,
    onError,
    timeout = 120000,
    perRequestTimeout = 60000,
  } = options;

  // Special handling for Supabase signed URLs
  const isSupabaseUrl =
    file.url.includes("supabase.co") && file.url.includes("token=");
  if (isSupabaseUrl) {
    console.log(
      "🔥 Detected Supabase signed URL, using direct download approach",
    );
    return downloadSupabaseFile(file, options);
  }

  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      const error = "Download timeout";
      onError?.(error, file.filename);
      reject(new Error(error));
    }, timeout);

    // Use API endpoint if assetId is provided, otherwise use direct URL
    const downloadUrl = file.assetId
      ? `/api/download/${file.assetId}`
      : file.url;

    fetch(downloadUrl, {
      signal: controller.signal,
      headers: {
        Accept: file.mimeType ?? "*/*",
        // Force the response to be treated as a download
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      // Use same-origin for API calls, cors for external URLs
      mode: file.assetId ? "same-origin" : "cors",
    })
      .then((response) => {
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = response.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body?.getReader();
        const chunks: BlobPart[] = [];

        if (!reader) {
          throw new Error("Response body is not readable");
        }

        return new Promise<Blob>((resolveBlob, rejectBlob) => {
          function read() {
            reader!
              .read()
              .then(({ done, value }) => {
                if (done) {
                  const blob = new Blob(chunks, {
                    type: file.mimeType ?? "application/octet-stream",
                  });
                  resolveBlob(blob);
                  return;
                }

                chunks.push(value);
                loaded += value.length;

                if (total > 0) {
                  onProgress?.(
                    Math.round((loaded / total) * 100),
                    file.filename,
                  );
                }

                read();
              })
              .catch(rejectBlob);
          }
          read();
        });
      })
      .then((blob) => {
        // Use the force download function
        forceDownload(blob, file.filename);

        onComplete?.();
        resolve();
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        const errorMessage =
          error instanceof Error && error.name === "AbortError"
            ? "Download was cancelled"
            : `Download failed: ${error instanceof Error ? error.message : String(error)}`;
        onError?.(errorMessage, file.filename);
        reject(new Error(errorMessage));
      });
  });
}

/**
 * Download multiple files as a ZIP archive
 */
export async function downloadFilesAsZip(
  files: DownloadableFile[],
  options: BatchDownloadOptions = {},
): Promise<void> {
  const {
    zipFilename = "download.zip",
    compress = true,
    onProgress,
    onComplete,
    onError,
    timeout = 180000,
  } = options;

  if (files.length === 0) {
    throw new Error("No files to download");
  }

  // For single file, download directly without ZIP
  if (files.length === 1) {
    const file = files[0];
    if (!file) {
      throw new Error("File not found");
    }
    return downloadFile(file, { onProgress, onComplete, onError, timeout });
  }

  const zip = new JSZip();
  let completedFiles = 0;
  const totalFiles = files.length;
  const seenZipPaths = new Set<string>();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const downloadPromises = files.map(async (file) => {
    try {
      // Prefer API route if provided to avoid CORS issues
      const downloadUrl = file.assetId
        ? `/api/download/${file.assetId}`
        : file.url;

      // Adaptive per-request timeout based on file size (20s per 10MB, clamped 45-180s)
      const perReq = Math.min(
        Math.max(
          Math.floor(((file.size ?? 10 * 1024 * 1024) / (10 * 1024 * 1024))) *
            20000 +
            45000,
          45000,
        ),
        180000,
      );
      const blob = await fetchFileBlob(downloadUrl, file.mimeType, perReq);

      // Add file to ZIP with collision-safe path
      const uniquePath = ensureUniqueZipPath(seenZipPaths, file.filename);
      zip.file(uniquePath, blob, {
        compression: compress ? "DEFLATE" : "STORE",
      });

      completedFiles++;
      onProgress?.(
        Math.round((completedFiles / totalFiles) * 100),
        file.filename,
      );
    } catch (error) {
      const errorMessage = `Failed to download ${file.filename}: ${error instanceof Error ? error.message : String(error)}`;
      onError?.(errorMessage, file.filename);
      throw error;
    }
  });

  try {
    await Promise.all(downloadPromises);

    // Generate and download ZIP file
    onProgress?.(100, "Creating ZIP file...");

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: compress ? "DEFLATE" : "STORE",
      compressionOptions: { level: 6 },
    });

    // Use the force download function to ensure file downloads
    forceDownload(zipBlob, zipFilename);

    onComplete?.();
  } catch (error) {
    const errorMessage = `ZIP creation failed: ${error instanceof Error ? error.message : String(error)}`;
    onError?.(errorMessage);
    throw new Error(errorMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if a file type should be compressed in ZIP
 */
export function shouldCompressFile(mimeType: string): boolean {
  const compressibleTypes = [
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/typescript",
    "application/yaml",
    "application/toml",
  ];

  return compressibleTypes.some((type) => mimeType.startsWith(type));
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "text/plain": ".txt",
    "text/html": ".html",
    "text/css": ".css",
    "application/json": ".json",
    "application/javascript": ".js",
    "application/typescript": ".ts",
  };

  return mimeToExt[mimeType] ?? "";
}

/**
 * Generate a safe filename with timestamp
 */
export function generateSafeFilename(baseName: string, extension = "") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeName = baseName
    .replace(/[\\\/\0\n\r\t\f\v:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeName}_${timestamp}${extension}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if the browser supports the File API and download capabilities
 */
export function checkDownloadSupport(): {
  supported: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!window.fetch) {
    issues.push("Fetch API not supported");
  }

  if (!window.Blob) {
    issues.push("Blob API not supported");
  }

  if (!window.URL || !URL.createObjectURL) {
    issues.push("URL API not supported");
  }

  if (!document.createElement("a").download) {
    issues.push("Download attribute not supported");
  }

  // Check for specific browser quirks
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
    issues.push("Safari download behavior may be limited");
  }

  return {
    supported: issues.length === 0,
    issues,
  };
}

/**
 * Validate file size before download
 */
export function validateFileSize(
  fileSizeBytes: number,
  maxSizeBytes: number = 100 * 1024 * 1024,
): boolean {
  return fileSizeBytes <= maxSizeBytes;
}

/**
 * Get recommended chunk size based on file size
 */
export function getOptimalChunkSize(fileSizeBytes: number): number {
  if (fileSizeBytes < 1024 * 1024) return 64 * 1024; // 64KB for small files
  if (fileSizeBytes < 10 * 1024 * 1024) return 256 * 1024; // 256KB for medium files
  if (fileSizeBytes < 100 * 1024 * 1024) return 1024 * 1024; // 1MB for large files
  return 2 * 1024 * 1024; // 2MB for very large files
}

/**
 * Check if the download should use streaming for large files
 */
export function shouldUseStreaming(fileSizeBytes: number): boolean {
  return fileSizeBytes > 50 * 1024 * 1024; // Use streaming for files > 50MB
}

/**
 * Handle download errors with user-friendly messages
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Download was cancelled";
    }

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return "Network error - please check your internet connection";
    }

    if (error.message.includes("HTTP")) {
      return "File not available or access denied";
    }

    if (error.message.includes("quota")) {
      return "Storage quota exceeded";
    }

    if (error.message.includes("timeout")) {
      return "Download timeout - file may be too large";
    }
  }

  return "Download failed - please try again";
}

/**
 * Enhanced download function with better error handling and edge case management
 */
export async function downloadFileEnhanced(
  file: DownloadableFile,
  options: DownloadOptions = {},
): Promise<void> {
  const { onProgress, onComplete, onError, timeout = 120000 } = options;

  // Check browser support
  const support = checkDownloadSupport();
  if (!support.supported) {
    const error = `Browser not supported: ${support.issues.join(", ")}`;
    onError?.(error, file.filename);
    throw new Error(error);
  }

  // Validate file size if provided
  if (file.size && !validateFileSize(file.size)) {
    const error = `File too large: ${formatFileSize(file.size)}. Maximum size is ${formatFileSize(100 * 1024 * 1024)}`;
    onError?.(error, file.filename);
    throw new Error(error);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(file.url, {
      signal: controller.signal,
      headers: {
        Accept: file.mimeType ?? "*/*",
        "Cache-Control": "no-cache",
      },
      mode: "cors",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    const total = contentLength
      ? parseInt(contentLength, 10)
      : (file.size ?? 0);

    // Use streaming for large files
    if (shouldUseStreaming(total)) {
      await handleStreamingDownload(response, file, total, onProgress);
    } else {
      await handleStandardDownload(response, file);
    }

    onComplete?.();
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage = getErrorMessage(error);
    onError?.(errorMessage, file.filename);
    throw new Error(errorMessage);
  }
}

/**
 * Handle standard downloads with progress tracking
 */
async function handleStandardDownload(
  response: Response,
  file: DownloadableFile,
): Promise<void> {
  const blob = await response.blob();

  // Use the force download function
  forceDownload(blob, file.filename);
}

/**
 * Handle streaming downloads for large files
 */
async function handleStreamingDownload(
  response: Response,
  file: DownloadableFile,
  total: number,
  onProgress?: (progress: number, file?: string) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const chunks: BlobPart[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (total > 0) {
      onProgress?.(Math.round((receivedLength / total) * 100), file.filename);
    }
  }

  const blob = new Blob(chunks, {
    type: file.mimeType ?? "application/octet-stream",
  });

  // Use the force download function
  forceDownload(blob, file.filename);
}

/**
 * Estimate download time based on file size and connection speed
 */
export function estimateDownloadTime(
  fileSizeBytes: number,
  connectionSpeedKbps = 1024,
): number {
  // Convert to bits and estimate time in seconds
  const fileSizeBits = fileSizeBytes * 8;
  const connectionSpeedBps = connectionSpeedKbps * 1024;
  return Math.ceil(fileSizeBits / connectionSpeedBps);
}
