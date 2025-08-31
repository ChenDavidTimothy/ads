"use client";

import React from "react";
import { BindButton } from "@/components/workspace/binding/bindings";
import { BatchButton } from "./BatchButton";
import { BatchModal } from "./BatchModal";

export function BindingAndBatchControls({
  bindProps,
  batchProps,
}: {
  bindProps: { nodeId: string; bindingKey: string; objectId?: string };
  batchProps: { nodeId: string; fieldPath: string; objectId?: string; valueType: "number" | "string" };
}) {
  const [open, setOpen] = React.useState(false);

  // Debug logging
  console.log("[BindingAndBatchControls] Rendering:", { bindProps, batchProps });

  return (
    <div className="flex items-center gap-[var(--space-1)]">
      <BindButton {...bindProps} />
      <BatchButton
        nodeId={batchProps.nodeId}
        fieldPath={batchProps.fieldPath}
        objectId={batchProps.objectId}
        onOpen={() => setOpen(true)}
      />
      {open ? (
        <BatchModal
          isOpen={open}
          onClose={() => setOpen(false)}
          nodeId={batchProps.nodeId}
          fieldPath={batchProps.fieldPath}
          objectId={batchProps.objectId}
          valueType={batchProps.valueType}
        />
      ) : null}
    </div>
  );
}


