import fs from "fs/promises";
import path from "path";

import { logger } from "@/lib/logger";
import { ensureDir } from "../path-utils";
import {
  SharedCacheJanitor,
  type JanitorConfig,
} from "../shared-cache-janitor";

export class CacheMaintenance {
  private static hardLinkTestCompleted = false;
  private static hardLinkTestPromise: Promise<void> | null = null;

  private readonly sharedCacheDir: string;
  private readonly jobCacheDir: string;

  constructor(sharedCacheDir: string, jobCacheDir: string) {
    this.sharedCacheDir = sharedCacheDir;
    this.jobCacheDir = jobCacheDir;
  }

  async ensureDirectories(
    options: { logOnSuccess?: boolean } = {},
  ): Promise<void> {
    try {
      await ensureDir(this.sharedCacheDir);
      await ensureDir(this.jobCacheDir);
      if (options.logOnSuccess ?? true) {
        logger.debug("Cache directories initialized", {
          sharedCacheDir: this.sharedCacheDir,
          jobCacheDir: this.jobCacheDir,
        });
      }
    } catch (error) {
      logger.error("Failed to initialize cache directories", {
        sharedCacheDir: this.sharedCacheDir,
        jobCacheDir: this.jobCacheDir,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async startJanitor(
    config?: Partial<JanitorConfig>,
  ): Promise<SharedCacheJanitor> {
    await this.ensureDirectories();
    const janitor = new SharedCacheJanitor(this.sharedCacheDir, config);
    await janitor.start();
    return janitor;
  }

  stopJanitor(janitor?: SharedCacheJanitor): void {
    if (janitor) {
      janitor.stop();
    }
  }

  async ensureHardLinkCapability(): Promise<void> {
    if (CacheMaintenance.hardLinkTestCompleted) {
      return CacheMaintenance.hardLinkTestPromise ?? Promise.resolve();
    }

    CacheMaintenance.hardLinkTestPromise ??= this.performStartupHardLinkTest()
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.warn("Failed to perform hard link startup test", {
          error: errorMessage,
        });
      })
      .finally(() => {
        CacheMaintenance.hardLinkTestCompleted = true;
        CacheMaintenance.hardLinkTestPromise = null;
      });

    await CacheMaintenance.hardLinkTestPromise;
  }

  private async performStartupHardLinkTest(): Promise<void> {
    await this.ensureDirectories({ logOnSuccess: false });

    const testContent = `hardlink-test-${Date.now()}`;
    const testSource = path.join(this.sharedCacheDir, ".hardlink-test");
    const testTarget = path.join(this.jobCacheDir, ".hardlink-test");

    await fs.writeFile(testSource, testContent);

    try {
      await fs.link(testSource, testTarget);

      const targetContent = await fs.readFile(testTarget, "utf8");
      const sourceStats = await fs.stat(testSource);
      const targetStats = await fs.stat(testTarget);

      if (
        targetContent === testContent &&
        sourceStats.ino === targetStats.ino
      ) {
        logger.info(
          "Hard link test passed - optimal cache performance enabled",
          {
            sharedCacheDir: this.sharedCacheDir,
            jobCacheDir: this.jobCacheDir,
          },
        );
      } else {
        logger.warn("Hard link test inconclusive - may use copy fallbacks");
      }

      await Promise.all([
        fs.unlink(testSource).catch(() => {
          // Ignore cleanup errors
        }),
        fs.unlink(testTarget).catch(() => {
          // Ignore cleanup errors
        }),
      ]);
    } catch (linkError: unknown) {
      if (
        linkError &&
        typeof linkError === "object" &&
        "code" in linkError &&
        (linkError as NodeJS.ErrnoException).code === "EXDEV"
      ) {
        logger.warn(
          "Hard links not supported between cache directories - will use copy fallbacks",
          {
            reason: "Cross-filesystem",
            sharedCacheDir: this.sharedCacheDir,
            jobCacheDir: this.jobCacheDir,
            impact: "Doubled disk usage expected",
          },
        );
      } else {
        const errorMessage =
          linkError &&
          typeof linkError === "object" &&
          "message" in linkError &&
          typeof (linkError as { message?: string }).message === "string"
            ? (linkError as { message?: string }).message
            : String(linkError);
        logger.warn("Hard link test failed - will use copy fallbacks", {
          error: errorMessage,
          impact: "Doubled disk usage expected",
        });
      }

      await fs.unlink(testSource).catch(() => {
        // Ignore cleanup errors
      });
    }
  }
}
