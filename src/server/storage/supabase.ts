import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "@/env";
import type { StoragePreparedTarget, StorageProvider } from "./provider";
import { createServiceClient } from "@/utils/supabase/service";

export class SupabaseStorageProvider implements StorageProvider {
  private readonly userId: string | undefined;
  private readonly bucket: string;

  constructor(userId?: string) {
    this.userId = userId;
    this.bucket = env.SUPABASE_STORAGE_BUCKET;
  }

  async prepareTarget(extension: string, opts?: { userId?: string }): Promise<StoragePreparedTarget> {
    const uid = opts?.userId ?? this.userId ?? "anonymous";
    const unique = `${Date.now()}_${randomUUID()}`;
    const filename = `scene_${unique}.${extension}`;
    const remoteKey = path.posix.join(uid, "animations", filename);

    const tmpDir = path.join(process.cwd(), ".tmp", "videos");
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, filename);

    return { filePath, remoteKey };
  }

  async finalize(prepared: StoragePreparedTarget): Promise<{ publicUrl: string }> {
    const supabase = createServiceClient();
    let publicUrl: string | null = null;
    try {
      const fileBuffer = await fs.promises.readFile(prepared.filePath);

      const { error: upErr } = await supabase.storage
        .from(this.bucket)
        .upload(prepared.remoteKey, fileBuffer, {
          upsert: false,
          contentType: "video/mp4",
        });
      if (upErr) {
        throw upErr;
      }

      const { data: signed, error: urlErr } = await supabase.storage
        .from(this.bucket)
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
}


