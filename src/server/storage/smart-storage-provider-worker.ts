// src/server/storage/smart-storage-provider-worker.ts
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { workerEnv } from "../jobs/env";
import type { StoragePreparedTarget, StorageProvider, FinalizeOptions } from "./provider";
import { createServiceClient } from "@/utils/supabase/service-worker";

export class SmartStorageProvider implements StorageProvider {
  private readonly userId: string | undefined;
  private readonly imagesBucket: string;
  private readonly videosBucket: string;

  constructor(userId?: string) {
    this.userId = userId;
    this.imagesBucket = workerEnv.SUPABASE_IMAGES_BUCKET || 'images';
    this.videosBucket = workerEnv.SUPABASE_VIDEOS_BUCKET || 'videos';
  }

  private getBucketForExtension(extension: string): string {
    // Route to appropriate bucket based on file type
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
    
    const ext = extension.toLowerCase();
    
    if (imageExtensions.includes(ext)) {
      return this.imagesBucket;
    } else if (videoExtensions.includes(ext)) {
      return this.videosBucket;
    } else {
      // Default to images bucket for unknown types
      return this.imagesBucket;
    }
  }

  async prepareTarget(extension: string, opts?: { userId?: string }): Promise<StoragePreparedTarget> {
    const uid = opts?.userId ?? this.userId ?? "anonymous";
    const unique = `${Date.now()}_${randomUUID()}`;
    const filename = `scene_${unique}.${extension}`;
    const remoteKey = path.posix.join(uid, filename);

    const tmpDir = path.join(process.cwd(), ".tmp", "videos");
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, filename);

    return { filePath, remoteKey };
  }

  async finalize(prepared: StoragePreparedTarget, opts?: FinalizeOptions): Promise<{ publicUrl: string }> {
    const supabase = createServiceClient();
    let publicUrl: string | null = null;
    
    try {
      const fileBuffer = await fs.promises.readFile(prepared.filePath);
      
      // Determine bucket based on file extension
      const extension = path.extname(prepared.remoteKey).slice(1);
      const bucket = this.getBucketForExtension(extension);

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(prepared.remoteKey, fileBuffer, {
          upsert: false,
          contentType: opts?.contentType ?? this.getContentType(extension),
        });
      
      if (upErr) {
        throw upErr;
      }

      const { data: signed, error: urlErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(prepared.remoteKey, 60 * 60 * 24 * 7);
      
      if (urlErr || !signed) {
        throw (urlErr ?? new Error("Failed to create signed URL"));
      }
      
      publicUrl = signed.signedUrl;
      return { publicUrl };
    } finally {
      // Always attempt to cleanup the temp file
      try { await fs.promises.unlink(prepared.filePath); } catch {}
    }
  }

  private getContentType(extension: string): string {
    const ext = extension.toLowerCase();
    const contentTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}
