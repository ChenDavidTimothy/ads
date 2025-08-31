"use client";

import React, { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBatchOverrides } from "@/hooks/use-batch-overrides";
import { useBatchKeysForField } from "@/hooks/use-batch-keys";

type ValueType = "number" | "string";

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

  const handleSet = (k: string, raw: string) => {
    if (valueType === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return; // simple guard, avoid blocking UX
      setPerKeyOverride(k, n);
    } else {
      setPerKeyOverride(k, raw);
    }
  };

  const handleSetDefault = (raw: string) => {
    if (valueType === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setPerObjectDefault(undefined);
        return;
      }
      setPerObjectDefault(n);
    } else {
      setPerObjectDefault(raw);
    }
  };

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
            <div className="flex items-center gap-[var(--space-2)]">
              <Input
                value={(() => {
                  if (data.perObjectDefault == null) return "";
                  if (
                    typeof data.perObjectDefault === "object" &&
                    data.perObjectDefault !== null
                  ) {
                    return JSON.stringify(data.perObjectDefault);
                  }
                  // At this point, data.perObjectDefault is not an object, so String() is safe
                  return String(
                    data.perObjectDefault as string | number | boolean,
                  );
                })()}
                onChange={(e) => handleSetDefault(e.target.value)}
              />
              <Button variant="ghost" size="sm" onClick={() => clearOverride()}>
                Clear
              </Button>
            </div>

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
                        <Input
                          value={(() => {
                            if (current == null) return "";
                            if (
                              typeof current === "object" &&
                              current !== null
                            ) {
                              return JSON.stringify(current);
                            }
                            // At this point, current is not an object, so String() is safe
                            return String(current as string | number | boolean);
                          })()}
                          onChange={(e) => handleSet(k, e.target.value)}
                        />
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
      </div>
    </Modal>
  );
}
