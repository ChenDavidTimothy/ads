// src/shared/utils/__tests__/naming.test.ts

import { describe, it, expect } from "vitest";
import {
  sanitizeForFilename,
  buildContentBasename,
  buildFilename,
} from "../naming";

describe("Filename Sanitization", () => {
  describe("sanitizeForFilename", () => {
    it("should replace illegal characters with dashes", () => {
      expect(sanitizeForFilename('file\\with/invalid:chars*"<>|')).toBe(
        "file-with-invalid-chars"
      );
    });

    it("should replace whitespace with dashes", () => {
      expect(sanitizeForFilename("file with spaces")).toBe("file-with-spaces");
    });

    it("should collapse multiple dashes", () => {
      expect(sanitizeForFilename("file--with---multiple----dashes")).toBe(
        "file-with-multiple-dashes"
      );
    });

    it("should trim leading and trailing dashes", () => {
      expect(sanitizeForFilename("-file-")).toBe("file");
    });

    it("should handle null bytes and control characters", () => {
      expect(sanitizeForFilename("file\x00with\ncontrol\rchars\t")).toBe(
        "file-with-control-chars"
      );
    });

    it("should handle vertical tab and form feed", () => {
      expect(sanitizeForFilename("file\x0bwith\x0cchars")).toBe(
        "file-with-chars"
      );
    });

    it("should limit length to 200 characters", () => {
      const longInput = "a".repeat(300);
      expect(sanitizeForFilename(longInput)).toHaveLength(200);
    });

    it("should handle empty input", () => {
      expect(sanitizeForFilename("")).toBe("");
    });

    it("should handle input with only illegal characters", () => {
      expect(sanitizeForFilename('\\:*?"<>|')).toBe("");
    });

    it("should preserve alphanumeric characters and safe symbols", () => {
      expect(sanitizeForFilename("file_123.test-file")).toBe("file_123.test-file");
    });
  });

  describe("buildContentBasename", () => {
    it("should build basename from display name only", () => {
      expect(buildContentBasename("My Scene", undefined)).toBe("My-Scene");
    });

    it("should build basename with batch key", () => {
      expect(buildContentBasename("My Scene", "batch1")).toBe("My-Scene-batch1");
    });

    it("should sanitize both display name and batch key", () => {
      expect(buildContentBasename('Scene\\:*?"<>|', 'batch\\:*?"<>|')).toBe(
        "Scene-batch"
      );
    });

    it("should handle null batch key", () => {
      expect(buildContentBasename("My Scene", null)).toBe("My-Scene");
    });

    it("should handle empty display name", () => {
      expect(buildContentBasename("", "batch")).toBe("scene-batch");
    });

    it("should handle empty batch key", () => {
      expect(buildContentBasename("My Scene", "")).toBe("My-Scene");
    });
  });

  describe("buildFilename", () => {
    it("should build filename with extension", () => {
      expect(buildFilename("My Scene", ".mp4")).toBe("My-Scene.mp4");
    });

    it("should add dot to extension if missing", () => {
      expect(buildFilename("My Scene", "mp4")).toBe("My-Scene.mp4");
    });

    it("should include batch key in filename", () => {
      expect(buildFilename("My Scene", ".mp4", "batch1")).toBe(
        "My-Scene-batch1.mp4"
      );
    });

    it("should sanitize all components", () => {
      expect(
        buildFilename('Scene\\:*?"<>|', ".mp4", 'batch\\:*?"<>|')
      ).toBe("Scene-batch.mp4");
    });
  });

  describe("Collision Detection Compatibility", () => {
    // These tests ensure that collision detection and filename generation use the same sanitization
    it("should produce consistent results for collision detection", () => {
      const testCases = [
        "file:with:colons",
        "file\\with\\backslashes",
        "file/with/slashes",
        "file with spaces",
        'file"with"quotes',
        "file*with*asterisks",
        "file?with?questions",
        "file<with>brackets",
        "file|with|pipes",
        "file\x00with\x00nulls",
        "file\nwith\nnewlines",
        "file\rwith\rcarriage",
        "file\twith\ttabs",
        "file\x0bwith\x0bvertical",
        "file\x0cwith\x0cformfeed",
      ];

      testCases.forEach((input) => {
        const sanitized = sanitizeForFilename(input);
        // Ensure no illegal characters remain
        expect(sanitized).not.toMatch(/[\\\/\0\n\r\t\f\v:*?"<>|]/);
        // Ensure no multiple dashes
        expect(sanitized).not.toMatch(/-{2,}/);
        // Ensure no leading/trailing dashes
        expect(sanitized).not.toMatch(/^-|-$/);
      });
    });

    it("should prevent filename collisions that could cause data loss", () => {
      // These inputs would collide if using different sanitization schemes
      const collisionPairs = [
        ["file/with/slashes", "file-with-slashes"],
        ["file:with:colons", "file-with-colons"],
        ["file with spaces", "file-with-spaces"],
        ['file"with"quotes', "file-with-quotes"],
      ];

      collisionPairs.forEach(([input1, input2]) => {
        const result1 = sanitizeForFilename(input1);
        const result2 = sanitizeForFilename(input2);
        // Both should produce the same sanitized result
        expect(result1).toBe(result2);
      });
    });
  });
});
