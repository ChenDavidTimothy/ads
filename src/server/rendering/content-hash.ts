// src/server/rendering/content-hash.ts
import { createHash } from "crypto";
import { pipeline } from "stream/promises";
import fs from "fs";

export async function computeFileContentHash(
  filePath: string,
): Promise<string> {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);

  await pipeline(stream, hash);
  return hash.digest("hex");
}

export async function validateContentHash(
  filePath: string,
  expectedHash: string,
): Promise<boolean> {
  try {
    const actualHash = await computeFileContentHash(filePath);
    return actualHash === expectedHash;
  } catch {
    return false;
  }
}
