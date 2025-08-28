"use client";

import { useMemo } from "react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SceneObjectInfo {
  id: string;
  displayName: string;
  type: string;
}

interface Props {
  objects: SceneObjectInfo[];
  currentOrder: string[];
  onReorder: (newOrder: string[]) => void;
}

function SortableItem({ item, index }: { item: SceneObjectInfo; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={
        "flex cursor-move items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-3 text-[var(--text-primary)] transition-all hover:border-[var(--border-secondary)] hover:bg-[var(--surface-interactive)]"
      }
    >
      <div className="text-[var(--text-tertiary)]">≡</div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium">{item.displayName}</span>
      </div>
      <div className="rounded bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-tertiary)]">{index + 1}</div>
    </div>
  );
}

export function DraggableObjectList({ objects, currentOrder, onReorder }: Props) {

  // Compute the ordered list (back-to-front) from the persisted order
  const orderedBackToFront = useMemo(
    () =>
      currentOrder
        .map((id) => objects.find((o) => o.id === id))
        .filter((x): x is SceneObjectInfo => !!x),
    [currentOrder, objects],
  );

  // Display list front-to-back so the top visually corresponds to the front
  const orderedFrontToBack = useMemo(
    () => [...orderedBackToFront].reverse(),
    [orderedBackToFront],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Work with the front-to-back presentation array
    const idsFront = orderedFrontToBack.map((o) => o.id);
    const oldIndex = idsFront.indexOf(String(active.id));
    const newIndex = idsFront.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newIdsFront = arrayMove(idsFront, oldIndex, newIndex);
    // Convert back to the persisted back-to-front order before saving
    const newBackToFront = [...newIdsFront].reverse();
    onReorder(newBackToFront);
  };

  if (orderedFrontToBack.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-center text-[var(--text-tertiary)]">
        <div>
          <div className="mb-2">No objects in this scene yet</div>
          <div className="text-xs">Connect shapes, text, or images to see them here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-x-hidden">
      <div className="mb-3 flex justify-between text-xs text-[var(--text-tertiary)]">
        <span>↑ Front (renders on top)</span>
        <span>
          {orderedFrontToBack.length} object{orderedFrontToBack.length !== 1 ? "s" : ""}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedFrontToBack.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1 overflow-x-hidden rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-2)] p-2">
            {orderedFrontToBack.map((o, index) => (
              <SortableItem key={o.id} item={o} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex justify-between text-xs text-[var(--text-tertiary)]">
        <span>↓ Back (renders behind)</span>
      </div>
    </div>
  );
}

