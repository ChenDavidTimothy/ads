"use client";

import React, { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBatchOverrides } from "@/hooks/use-batch-overrides";
import { useBatchKeysForField } from "@/hooks/use-batch-keys";
import {
  NumberField,
  ColorField,
  TextareaField,
  TextField,
} from "@/components/ui/form-fields";
import { AssetSelectionModal } from "@/components/workspace/media/asset-selection-modal";
import NextImage from "next/image";
import { ImageOff } from "lucide-react";
import { api } from "@/trpc/react";

type ValueType = "number" | "string";

type FieldKind = "media-asset" | "color" | "textarea" | "number" | "string";

function classifyField(fieldPath: string, fallback: ValueType): FieldKind {
  // Media asset id
  if (fieldPath === "Media.imageAssetId") return "media-asset";

  // Colors (Canvas, Typography, and Timeline)
  const colorFields = new Set([
    "Canvas.fillColor",
    "Canvas.strokeColor",
    "Typography.fillColor",
    "Typography.strokeColor",
    "Timeline.color.from",
    "Timeline.color.to",
  ]);
  if (colorFields.has(fieldPath)) return "color";

  // Typography content
  if (fieldPath === "Typography.content") return "textarea";

  // Numeric fields across editors
  const numberFields = new Set([
    // Canvas
    "Canvas.position.x",
    "Canvas.position.y",
    "Canvas.scale.x",
    "Canvas.scale.y",
    "Canvas.rotation",
    "Canvas.opacity",
    "Canvas.strokeWidth",
    // Typography
    "Typography.fontSize",
    "Typography.strokeWidth",
    // Media
    "Media.cropX",
    "Media.cropY",
    "Media.cropWidth",
    "Media.cropHeight",
    "Media.displayWidth",
    "Media.displayHeight",
  ]);
  if (numberFields.has(fieldPath)) return "number";

  // Fallback to provided valueType
  return fallback === "number" ? "number" : "string";
}

function AssetThumb({ assetId }: { assetId?: string }) {
  const { data: assetDetails, isLoading } = api.assets.list.useQuery(
    {
      limit: 100,
      offset: 0,
      bucketName: "images",
    },
    {
      enabled: !!assetId,
      select: (response) =>
        response.assets.find((asset) => asset.id === assetId),
    },
  );

  if (!assetId) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded bg-[var(--surface-1)]">
        <ImageOff size={16} className="text-[var(--text-tertiary)]" />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded bg-[var(--surface-1)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
      </div>
    );
  }
  if (!assetDetails) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded bg-[var(--surface-1)]">
        <ImageOff size={16} className="text-[var(--text-tertiary)]" />
      </div>
    );
  }
  return (
    <div className="h-12 w-12 overflow-hidden rounded bg-[var(--surface-1)]">
      {assetDetails.public_url && (
        <NextImage
          src={assetDetails.public_url}
          alt={assetDetails.original_name}
          width={48}
          height={48}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function BatchModal({
  isOpen,
  onClose,
  nodeId,
  fieldPath,
  objectId,
  valueType,
}: {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  fieldPath: string;
  objectId?: string;
  valueType: ValueType;
}) {
  const { data, setPerObjectDefault, setPerKeyOverride, clearOverride } =
    useBatchOverrides(nodeId, fieldPath, objectId);
  const { keys } = useBatchKeysForField(nodeId, fieldPath, objectId);
  const kind = classifyField(fieldPath, valueType);

  const [query, setQuery] = useState("");
  const filteredKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.toLowerCase().includes(q));
  }, [keys, query]);

  // Orphaned keys: present in overrides but not upstream
  const orphaned = useMemo(() => {
    const present = new Set(keys);
    return Object.keys(data.perKeyOverrides).filter((k) => !present.has(k));
  }, [data.perKeyOverrides, keys]);

  // Media asset picker state
  const [assetPicker, setAssetPicker] = useState<
    { scope: "default" } | { scope: "key"; key: string } | null
  >(null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Batch Overrides" size="lg">
      <div className="p-[var(--space-4)]">
        <div className="mb-[var(--space-3)] flex items-center justify-between gap-[var(--space-2)]">
          <div className="text-sm text-[var(--text-secondary)]">
            Field:{" "}
            <span className="text-[var(--text-primary)]">{fieldPath}</span>
          </div>
          <input
            className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-2 py-1 text-xs"
            placeholder="Search keys"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div className="space-y-[var(--space-2)]">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">
              Default (all keys)
            </div>
            {(() => {
              switch (kind) {
                case "media-asset": {
                  const assetId =
                    (data.perObjectDefault as string | undefined) ?? "";
                  return (
                    <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <AssetThumb assetId={assetId} />
                        <div className="flex-1" />
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => setAssetPicker({ scope: "default" })}
                        >
                          {assetId ? "Change Image" : "Select Image"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => clearOverride()}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  );
                }
                case "color": {
                  return (
                    <div className="flex items-center gap-[var(--space-2)]">
                      <ColorField
                        label="Value"
                        value={(data.perObjectDefault as string) || "#000000"}
                        onChange={(v) => setPerObjectDefault(v)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearOverride()}
                      >
                        Clear
                      </Button>
                    </div>
                  );
                }
                case "textarea": {
                  return (
                    <div className="space-y-[var(--space-1)]">
                      <TextareaField
                        label="Value"
                        value={(data.perObjectDefault as string) || ""}
                        onChange={(v) => setPerObjectDefault(v)}
                        rows={4}
                      />
                      <div className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearOverride()}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  );
                }
                case "number": {
                  return (
                    <div className="flex items-center gap-[var(--space-2)]">
                      <NumberField
                        label="Value"
                        value={
                          typeof data.perObjectDefault === "number"
                            ? data.perObjectDefault
                            : undefined
                        }
                        onChange={(n) => setPerObjectDefault(n)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearOverride()}
                      >
                        Clear
                      </Button>
                    </div>
                  );
                }
                case "string":
                default: {
                  return (
                    <div className="flex items-center gap-[var(--space-2)]">
                      <TextField
                        label="Value"
                        value={
                          typeof data.perObjectDefault === "string"
                            ? data.perObjectDefault
                            : ""
                        }
                        onChange={(v) => setPerObjectDefault(v)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearOverride()}
                      >
                        Clear
                      </Button>
                    </div>
                  );
                }
              }
            })()}

            <div className="mt-[var(--space-3)] text-xs font-semibold text-[var(--text-secondary)]">
              Keys ({filteredKeys.length})
            </div>
            <div className="max-h-64 overflow-auto border border-[var(--border-primary)]">
              {filteredKeys.length === 0 ? (
                <div className="p-2 text-xs text-[var(--text-tertiary)]">
                  No keys match.
                </div>
              ) : (
                filteredKeys.map((k) => {
                  const current = data.perKeyOverrides[k];
                  return (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-[var(--space-2)] border-b border-[var(--border-primary)] p-2 last:border-b-0"
                    >
                      <div className="text-xs text-[var(--text-secondary)]">
                        {k}
                      </div>
                      <div className="flex items-center gap-[var(--space-2)]">
                        {kind === "media-asset" ? (
                          <>
                            <AssetThumb
                              assetId={(current as string | undefined) ?? ""}
                            />
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() =>
                                setAssetPicker({ scope: "key", key: k })
                              }
                            >
                              {(current as string | undefined)
                                ? "Change"
                                : "Select"}
                            </Button>
                          </>
                        ) : kind === "color" ? (
                          <input
                            type="color"
                            value={
                              typeof current === "string" && current
                                ? current
                                : "#000000"
                            }
                            onChange={(e) =>
                              setPerKeyOverride(k, e.target.value)
                            }
                            className="h-8 w-10 cursor-pointer rounded border border-[var(--border-primary)] bg-[var(--surface-2)]"
                          />
                        ) : kind === "textarea" ? (
                          <textarea
                            value={typeof current === "string" ? current : ""}
                            onChange={(e) =>
                              setPerKeyOverride(k, e.target.value)
                            }
                            rows={2}
                            className="min-w-[180px] resize-y rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-2 py-1 text-xs"
                          />
                        ) : kind === "number" ? (
                          <Input
                            type="number"
                            value={
                              typeof current === "number" ||
                              typeof current === "string"
                                ? String(current)
                                : ""
                            }
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              setPerKeyOverride(k, n);
                            }}
                          />
                        ) : (
                          <Input
                            value={typeof current === "string" ? current : ""}
                            onChange={(e) =>
                              setPerKeyOverride(k, e.target.value)
                            }
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearOverride(k)}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-[var(--space-2)]">
            <div className="text-xs text-[var(--text-tertiary)]">
              Overrides apply only when the field is not bound for the target
              object. Bound fields take precedence per resolver.
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              Changes are saved immediately.
            </div>
            {orphaned.length > 0 && (
              <div className="rounded border border-[var(--warning-600)] bg-[var(--warning-950)] p-2 text-xs text-[var(--warning-300)]">
                <div className="mb-1 font-semibold">Orphaned overrides</div>
                <div className="mb-2">
                  {orphaned.length} key{orphaned.length > 1 ? "s" : ""} no
                  longer present upstream
                </div>
                <div className="flex flex-wrap gap-[var(--space-1)]">
                  {orphaned.slice(0, 6).map((k) => (
                    <span
                      key={k}
                      className="rounded bg-[var(--warning-800)] px-1 py-0.5"
                    >
                      {k}
                    </span>
                  ))}
                  {orphaned.length > 6 && <span>…</span>}
                </div>
                <div className="mt-2 text-right">
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => orphaned.forEach((k) => clearOverride(k))}
                  >
                    Remove all orphaned overrides
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-[var(--space-4)] text-right">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Media asset selection modal */}
        {kind === "media-asset" && assetPicker ? (
          <AssetSelectionModal
            isOpen={true}
            onClose={() => setAssetPicker(null)}
            onSelect={(asset) => {
              if (assetPicker.scope === "default") {
                setPerObjectDefault(asset.id);
              } else if (assetPicker.scope === "key") {
                setPerKeyOverride(assetPicker.key, asset.id);
              }
              setAssetPicker(null);
            }}
            selectedAssetId={(() => {
              if (assetPicker.scope === "default") {
                return (
                  (data.perObjectDefault as string | undefined) ?? undefined
                );
              }
              const cur = data.perKeyOverrides[assetPicker.key];
              return (cur as string | undefined) ?? undefined;
            })()}
          />
        ) : null}
      </div>
    </Modal>
  );
}
