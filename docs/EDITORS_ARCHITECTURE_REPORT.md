# EDITORS_ARCHITECTURE_REPORT.md

## Table of Contents
1. [Overview](#overview)
2. [File Map and Components](#file-map-and-components)
3. [Field Model and Rendering Pipeline](#field-model-and-rendering-pipeline)
4. [Object Targeting and Per-Object Overrides](#object-targeting-and-per-object-overrides)
5. [Binding System Integration](#binding-system-integration)
6. [Graph Reachability / Batching Potential](#graph-reachability--batching-potential)
7. [Metadata Pass-Through in UI](#metadata-pass-through-in-ui)
8. [Feature Flags and Gating](#feature-flags-and-gating)
9. [Persistence and Serialization](#persistence-and-serialization)
10. [Scene/Render Interaction](#scenerender-interaction)
11. [Gaps and Risks for Batch v1 UI](#gaps-and-risks-for-batch-v1-ui)
12. [Appendix: Code References](#appendix-code-references)

---

## Overview

The Batchion codebase implements a sophisticated property editor system for Typography, Animation, Canvas, and Media nodes. The architecture follows a consistent three-panel layout with object selection, content area, and properties sidebar. Each editor supports per-object overrides, variable bindings, and batch override capabilities (currently feature-flagged).

### Framework and Major Modules

The editor system is built on React with the following key architectural components:

- **Main Editor Tabs**: Located in `src/components/workspace/` as separate components
- **Shared Form Fields**: `src/components/ui/form-fields.tsx` provides unified field rendering
- **Binding System**: `src/components/workspace/binding/bindings.tsx` handles variable connections
- **Property Resolution**: `src/shared/properties/` handles override precedence and assignment merging
- **Feature Flags**: `src/shared/feature-flags.ts` controls batch override UI visibility

### Primary Editors Covered

1. **Typography Editor** (`typography-editor-tab.tsx`)
   - Text content, font properties, colors, stroke settings
   - Supports text object filtering and per-object overrides

2. **Canvas Editor** (`canvas-editor-tab.tsx`)
   - Position, scale, rotation, opacity, colors, stroke properties
   - Handles all upstream object types with conditional color rendering

3. **Media Editor** (`media-editor-tab.tsx`)
   - Image asset selection, crop settings, display sizing
   - Asset management with modal-based selection

4. **Animation Editor** (`timeline-editor-tab.tsx`)
   - Timeline-based track editing with per-object assignments
   - Complex track property overrides and bindings

---

## File Map and Components

### Typography Editor
- **Main Component**: `src/components/workspace/typography-editor-tab.tsx`
- **Key Features**: Lines 78-905 contain the complete editor implementation
- **Supporting Components**:
  - `TypographyDefaultProperties` (lines 78-398): Global typography defaults
  - `TypographyPerObjectProperties` (lines 400-905): Per-object overrides
  - Badge components for binding/override status

### Canvas Editor
- **Main Component**: `src/components/workspace/canvas-editor-tab.tsx`
- **Key Features**: Lines 73-292 contain the main editor structure
- **Supporting Components**:
  - `CanvasDefaultProperties` (lines 294-696): Global canvas defaults with conditional color rendering
  - `CanvasPerObjectProperties` (lines 698-1283): Per-object overrides with object-type awareness
  - Unified badge components using `UnifiedOverrideBadge`

### Media Editor
- **Main Component**: `src/components/workspace/media-editor-tab.tsx`
- **Key Features**: Lines 56-981 contain the complete editor implementation
- **Supporting Components**:
  - `MediaDefaultProperties` (lines 56-457): Global media defaults with asset selection
  - `MediaPerObjectProperties` (lines 459-981): Per-object media overrides
  - `AssetSelectionModal` for image asset management

### Animation Editor
- **Main Component**: `src/components/workspace/timeline-editor-tab.tsx`
- **Key Features**: Lines 24-352 contain the main editor structure
- **Supporting Components**:
  - `TimelineEditorCore`: Core timeline rendering and track manipulation
  - Track property editing with complex override merging

### Shared Components
- **Form Fields**: `src/components/ui/form-fields.tsx` (lines 1-477)
  - `NumberField`, `ColorField`, `SelectField`, `TextareaField` with binding support
- **Binding System**: `src/components/workspace/binding/bindings.tsx` (lines 1-473)
  - `BindButton`, `useVariableBinding` hook, modal-based variable selection
- **Selection UI**: `src/components/ui/selection.tsx` for object lists
- **Badge System**: `src/components/workspace/binding/badges.tsx` for status indicators

---

## Field Model and Rendering Pipeline

### Field Schema Definition

Field schemas are defined in the node registry system. Each editor field follows a consistent pattern:

```typescript
// Example from typography node definition
properties: {
  content: { type: "string", required: true },
  fontFamily: { type: "string", default: "Arial" },
  fontSize: { type: "number", default: 24, min: 8, max: 200 },
  // ... more fields
}
```

### Field Rendering Pipeline

The field rendering follows this consistent pattern across all editors:

1. **Data Resolution**: Node-level defaults merged with user values
2. **Value Resolution**: Per-object overrides → node defaults → system defaults
3. **UI Rendering**: Form field components with binding adornments
4. **State Management**: Direct flow updates via `updateFlow`

#### Typography.content Example

```12:15:src/components/workspace/typography-editor-tab.tsx
// Value resolution for content field
const content = data.content ?? def.content ?? "Sample Text";
```

```156:182:src/components/workspace/typography-editor-tab.tsx
<TextareaField
  label="Text Content"
  value={content}
  onChange={(content) =>
    updateFlow({
      nodes: state.flow.nodes.map((n) =>
        n.data?.identifier?.id !== nodeId
          ? n
          : { ...n, data: { ...n.data, content } },
      ),
    })
  }
  rows={4}
  bindAdornment={<BindButton nodeId={nodeId} bindingKey="content" />}
  disabled={isBound("content")}
  inputClassName={leftBorderClass("content")}
/>
```

#### Canvas.position.x Example

```369:387:src/components/workspace/canvas-editor-tab.tsx
<NumberField
  label=""
  value={posX}
  onChange={(x) =>
    updateFlow({
      nodes: state.flow.nodes.map((n) =>
        n.data?.identifier?.id !== nodeId
          ? n
          : {
              ...n,
              data: {
                ...(n.data as CanvasNodeData),
                position: {
                  ...(n.data as CanvasNodeData)?.position,
                  x,
                },
              },
            },
      ),
    })
  }
  defaultValue={0}
  bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.x" />}
  disabled={isBound("position.x")}
  inputClassName={leftBorderClass("position.x")}
/>
```

#### Media.imageAssetId Example

```144:246:src/components/workspace/media-editor-tab.tsx
// Asset selection with modal
<Button
  variant="secondary"
  size="sm"
  onClick={() => setShowAssetModal(true)}
  disabled={isBound("imageAssetId")}
  className={`w-full ${leftBorderClass("imageAssetId")}`}
>
  <Image size={14} className="mr-2" aria-label="Image icon" />
  {imageAssetId ? "Change Image" : "Override Image"}
</Button>

// Asset details display
{imageAssetId && assetDetails ? (
  <div className="flex items-center gap-[var(--space-3)]">
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
    // ... more asset details
  </div>
) : null}
```

### Call Graph for Field Rendering

```
FormField Component
├── Field-specific component (NumberField, ColorField, etc.)
├── BindButton (binding system integration)
├── Badge components (status indicators)
├── State update via updateFlow
└── Value resolution pipeline
    ├── Per-object override check
    ├── Node-level default fallback
    └── System default fallback
```

---

## Object Targeting and Per-Object Overrides

### Multiple Object ID Collection/Display

All editors use a consistent pattern for object collection via `FlowTracker`:

```12:15:src/components/workspace/typography-editor-tab.tsx
const upstreamObjects = useMemo(() => {
  const tracker = new FlowTracker();
  const objectDescriptors = tracker.getUpstreamObjects(
    nodeId,
    state.flow.nodes,
    state.flow.edges,
  );
  // Filter and convert to display format
}, [nodeId, state.flow.nodes, state.flow.edges]);
```

The `SelectionList` component provides consistent object selection UI:

```1008:1020:src/components/workspace/typography-editor-tab.tsx
<SelectionList
  mode="single"
  items={upstreamObjects.map((o) => ({
    id: o.data.identifier.id,
    label: o.data.identifier.displayName,
  }))}
  selectedId={selectedObjectId}
  onSelect={setSelectedObjectId}
  showDefault={true}
  defaultLabel="Default"
  emptyLabel="No text objects detected"
/>
```

### Per-Object Override Data Structures

#### ObjectAssignments Structure

```34:36:src/shared/properties/assignments.ts
export interface ObjectAssignments {
  initial?: ObjectInitialOverrides;
  tracks?: TrackOverride[];
}
```

#### PerObjectAssignments Map

```38:39:src/shared/properties/assignments.ts
export type PerObjectAssignments = Record<string, ObjectAssignments>;
```

#### Node-Level Storage

```78:81:src/shared/types/nodes.ts
variableBindingsByObject?: Record<
  string,
  Record<string, { target?: string; boundResultNodeId?: string }>
>;
perObjectAssignments?: PerObjectAssignments;
```

### Current Override Precedence

Precedence is handled by the resolution system in `src/shared/properties/resolver.ts`:

1. **Bound values** (highest priority)
2. **Per-object overrides** (`perObjectAssignments[objectId].initial`)
3. **Node-level defaults** (`node.data.*`)
4. **System defaults** (from node definition)

#### Precedence Implementation

```498:543:src/components/workspace/typography-editor-tab.tsx
const getValue = (key: string, fallbackValue: number | string) => {
  if (isBound(key)) return undefined; // Blank when bound

  switch (key) {
    case "content":
      return initial.content ?? base.content ?? def.content ?? fallbackValue;
    case "fontFamily":
      return fontFamily; // Already resolved above
    // ... more cases
  }
};
```

---

## Binding System Integration

### Field Binding Process

Fields become "bound" through the `BindButton` component:

```376:473:src/components/workspace/binding/bindings.tsx
export function BindButton({ nodeId, bindingKey, objectId }: BindButtonProps) {
  const { variables, getBinding, getBoundName, bind } = useVariableBinding(
    nodeId,
    objectId,
  );
  // Modal-based variable selection and binding
}
```

### BindingRef Storage

Bindings are stored in two locations depending on scope:

#### Node-Level Bindings (Global Defaults)
```220:227:src/shared/types/nodes.ts
variableBindings?: Record<
  string,
  {
    target?: string;
    boundResultNodeId?: string;
  }
>;
```

#### Per-Object Bindings
```228:237:src/shared/types/nodes.ts
variableBindingsByObject?: Record<
  string,
  Record<
    string,
    {
      target?: string;
      boundResultNodeId?: string;
    }
  >
>;
```

### UI State When Bound

When a field is bound, the UI shows several indicators:

1. **Disabled Input**: `disabled={isBound("fieldName")}`
2. **Visual Border**: `inputClassName={leftBorderClass("fieldName")}`
3. **Binding Badge**: Shows "Bound: NodeName"
4. **Bind Button Indicator**: Shows filled link icon

#### Bound Field Rendering

```156:173:src/components/workspace/typography-editor-tab.tsx
<TextareaField
  label="Text Content"
  value={content}
  onChange={(content) => /* update logic */}
  bindAdornment={<BindButton nodeId={nodeId} bindingKey="content" />}
  disabled={isBound("content")}
  inputClassName={leftBorderClass("content")}
/>
```

#### Binding Badge Display

```174:181:src/components/workspace/typography-editor-tab.tsx
{isBound("content") && (
  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
    <div className="flex items-center gap-[var(--space-1)]">
      <TypographyBindingBadge nodeId={nodeId} keyName="content" />
    </div>
  </div>
)}
```

### Bound Value Resolution

When bound, the field shows the resolved value but input is disabled:

```498:510:src/components/workspace/typography-editor-tab.tsx
const getValue = (key: string, fallbackValue: number | string) => {
  if (isBound(key)) return undefined; // Blank when bound in per-object context
  // ... normal resolution logic
};
```

---

## Graph Reachability / Batching Potential

### Current Implementation Status

**Not found** - There is no compile-time or validation pass that marks objects "potentially batched" for UI purposes. The batch system operates entirely at runtime in the executors.

#### Backend Implementation

The batch logic is implemented in the executor pipeline:

```1561:1667:src/server/animation-processing/executors/logic-executor.ts
// Resolve key per object with precedence: per-object binding -> global binding -> literal
const perObjectVal = readVarForObject(objectId)("key");
const globalVal = readVarGlobal("key");
const literalVal = data.key;
let resolved: unknown = perObjectVal ?? globalVal ?? (typeof literalVal === "string" ? literalVal : undefined);
```

#### Scene Partitioning

Scene partitioning happens in `scene-partitioner.ts`:

```217:281:src/server/animation-processing/scene/scene-partitioner.ts
const nonBatched = base.objects.filter((o) => !o.batch);
const batched = base.objects.filter((o) => o.batch && typeof o.batchKey === "string");
// ... partitioning logic
```

### Suggested Implementation Location

To add compile-time batching potential detection, implement in:

1. **FlowTracker Enhancement**: `src/lib/flow/flow-tracking.ts`
2. **UI Integration**: Add to each editor's `upstreamObjects` computation
3. **Visual Indicators**: Show batch-eligible objects with special badges

---

## Metadata Pass-Through in UI

### Current Status

**Not found** - The editors do not currently read or display `perObjectBatchOverrides`, `perObjectBoundFields`, or batch metadata. The batch system operates entirely at the backend level.

#### Backend Metadata Flow

The backend passes batch metadata through the executor pipeline:

```typescript
// From logic-executor.ts
output.metadata = {
  perObjectBatchOverrides: resolvedKeys,
  perObjectBoundFields: boundFields,
  // ... other metadata
};
```

#### UI Gap

The editors have no mechanism to:
- Display which objects are batch-eligible
- Show current batch key assignments
- Preview batch override effects
- Indicate batch-related conflicts

### Potential Implementation

To add metadata awareness, editors would need:
- Access to batch metadata from upstream nodes
- Visual indicators for batch-eligible objects
- Preview of batch key resolution
- Conflict detection UI

---

## Feature Flags and Gating

### Current Batch Override UI Flag

```4:6:src/shared/feature-flags.ts
batchOverridesUI: false,
```

### Flag Usage Locations

The batch overrides UI is gated in multiple editors:

#### Typography Editor
```583:583:src/components/workspace/typography-editor-tab.tsx
// Removed UI: BatchOverridesFoldout
```

#### Media Editor
```578:578:src/components/workspace/media-editor-tab.tsx
// Removed UI: BatchOverridesFoldout
```

#### Canvas Editor
The canvas editor does not have batch override UI implemented yet.

### Flag Implementation Pattern

Flags are accessed through the shared feature flags module:

```typescript
import { features } from "@/shared/feature-flags";
// Usage: features.batchOverridesUI
```

---

## Persistence and Serialization

### Global Defaults Persistence

Global defaults are stored directly in node data:

```typescript
// Example from TypographyNodeData
export interface TypographyNodeData extends BaseNodeData {
  content?: string;
  fontFamily: string;
  fontSize: number;
  // ... other fields
}
```

### Per-Object Overrides Persistence

Per-object overrides use the `PerObjectAssignments` structure:

```typescript
node.data.perObjectAssignments = {
  [objectId]: {
    initial: {
      fontSize: 36,
      fillColor: "#ff0000"
    }
  }
};
```

### Serialization Paths

#### Node Data Serialization
The entire node data structure is serialized as part of the workspace state:

```typescript
// Workspace state includes all node data
interface WorkspaceState {
  flow: {
    nodes: Node<NodeData>[];
    edges: Edge[];
  };
  // ... other state
}
```

#### JSON Schema Structure

```json
{
  "flow": {
    "nodes": [
      {
        "data": {
          "identifier": { "id": "node_123", "type": "typography" },
          "content": "Hello World",
          "fontSize": 24,
          "perObjectAssignments": {
            "obj_456": {
              "initial": {
                "fontSize": 36
              }
            }
          },
          "variableBindings": {
            "fontSize": { "boundResultNodeId": "result_789" }
          }
        }
      }
    ]
  }
}
```

### Migration Considerations

Current migration patterns focus on node data transformation rather than per-key overrides. Adding batch overrides would require:

1. **Schema Extension**: Add `batchOverridesByField` to node data types
2. **Migration Logic**: Transform existing overrides to batch-aware format
3. **Backward Compatibility**: Handle nodes without batch override data

---

## Scene/Render Interaction

### Scene Preview State Independence

**Confirmed**: Editors do not depend on Scene preview state. The Batch v1 system operates without real-time preview, as confirmed by the batch status document.

#### Editor Isolation

Editors operate independently of render state:

```typescript
// Editors work with flow state only
const { state, updateFlow } = useWorkspace();
// No preview state dependencies
```

### Render Action Gathering

Render actions gather editor data through the execution pipeline:

#### Canvas Executor Integration

```73:100:src/server/animation-processing/executors/canvas-executor.ts
private async executeCanvas(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[],
): Promise<void> {
  // Gather node data, bindings, and assignments
  const data = node.data as unknown as NodeDataWithBindings;
  const bindings = data.variableBindings ?? {};
  const bindingsByObject = data.variableBindingsByObject ?? {};
  const assignments = data.perObjectAssignments ?? {};
  
  // Process objects with resolved properties
}
```

#### Backend Data Flow

1. **Editor State**: Stored in `node.data` (global defaults + per-object assignments)
2. **Execution Pipeline**: Canvas/Animation/Media executors process the data
3. **Scene Building**: Scene partitioner applies overrides at render time
4. **Final Output**: Rendered frames/videos with applied transformations

---

## Gaps and Risks for Batch v1 UI

### Missing Pieces for Minimal Batch v1 UI

#### 1. Batch Node Inspector Integration
**Location**: `src/components/workspace/property-panel.tsx`
**Current State**: Property panel handles basic node properties but not batch-specific UI
**Missing**: Key input field with validation and error surfacing

#### 2. Per-Field Batch Overrides UI
**Location**: Individual editor components
**Current State**: `BatchOverridesFoldout` components are removed/commented out
**Missing**: 
- Per-field batch override foldout component
- Key-value override management UI
- Default vs key-specific value handling

#### 3. Render Error Display Integration
**Location**: `src/components/workspace/result-log-modal.tsx`
**Current State**: Basic error display exists
**Missing**:
- Empty keys error surfacing
- Filename collision error display
- Batch-specific validation feedback

### Code Patterns That Could Conflict

#### 1. Conditional Rendering Based on Object Type

```593:693:src/components/workspace/canvas-editor-tab.tsx
{!upstreamObjectTypes.allText && (
  // Color properties - could conflict with batch overrides
)}
```

#### 2. Complex Override Merging Logic

```152:177:src/components/workspace/canvas-editor-tab.tsx
// Deep merging for position/scale - batch overrides need similar treatment
if (typeof baseInitial.position === "object" && baseInitial.position !== null) {
  mergedInitial.position = {
    ...(baseInitial.position as Record<string, unknown>),
    ...(updates.position as Record<string, unknown>),
  };
}
```

#### 3. Binding State Management

```217:371:src/components/workspace/binding/bindings.tsx
// Complex binding reset logic - batch overrides need integration
const resetToDefault = (rawKey: string): void => {
  // Current logic handles per-object overrides
  // Would need extension for batch override clearing
};
```

---

## Appendix: Code References

### Core Editor Components
- `src/components/workspace/typography-editor-tab.tsx` - Lines 1-1098
- `src/components/workspace/canvas-editor-tab.tsx` - Lines 1-1283  
- `src/components/workspace/media-editor-tab.tsx` - Lines 1-1157
- `src/components/workspace/timeline-editor-tab.tsx` - Lines 1-352

### Shared Systems
- `src/components/ui/form-fields.tsx` - Lines 1-477 (Form field components)
- `src/components/workspace/binding/bindings.tsx` - Lines 1-473 (Binding system)
- `src/shared/properties/assignments.ts` - Lines 1-187 (Assignment structures)
- `src/shared/properties/precedence.ts` - Lines 1-22 (Precedence rules)
- `src/shared/feature-flags.ts` - Lines 1-6 (Feature gating)

### Backend Integration
- `src/server/animation-processing/executors/canvas-executor.ts` - Lines 1-401
- `src/server/animation-processing/executors/logic-executor.ts` - Lines 1561-1667
- `src/server/animation-processing/scene/scene-partitioner.ts` - Lines 217-281
- `src/server/animation-processing/scene/batch-overrides-resolver.ts` - Batch override resolution

### Key Symbols Index
- `PerObjectAssignments` - Main per-object override structure
- `ObjectAssignments` - Individual object assignment container
- `variableBindings` - Node-level variable bindings
- `variableBindingsByObject` - Per-object variable bindings
- `batchOverridesByField` - Batch override data structure (defined but not used)
- `BindButton` - Variable binding UI component
- `FlowTracker` - Object detection and flow analysis
- `updateFlow` - Main state update mechanism

---

## One-Page Summary

### Exact Components to Modify for Batch v1 UI Wiring

#### 1. Batch Node Inspector
**File**: `src/components/workspace/property-panel.tsx` (lines 200+)
**Required Changes**:
- Add key input field with validation
- Integrate error surfacing for empty keys/filename collisions
- Add batch metadata display (object count, key distribution)

#### 2. Editor Subpanel Mount Points
**Files**:
- `src/components/workspace/typography-editor-tab.tsx` (line ~583)
- `src/components/workspace/canvas-editor-tab.tsx` (after line 693)
- `src/components/workspace/media-editor-tab.tsx` (line ~578)
- `src/components/workspace/timeline-editor-tab.tsx` (after track properties)

**Required Changes**:
- Restore `BatchOverridesFoldout` component
- Add per-field override management UI
- Implement key-value override persistence

#### 3. Render Error Display
**File**: `src/components/workspace/result-log-modal.tsx`
**Required Changes**:
- Add batch-specific error categories
- Surface empty key validation errors
- Display filename collision warnings

### Blockers/Ambiguities Needing Decisions

#### 1. Feature Flag Strategy
**Decision Needed**: Whether to enable `batchOverridesUI` flag immediately or implement behind separate flag

#### 2. UI Component Ownership
**Decision Needed**: Whether batch override foldouts should be shared components or editor-specific

#### 3. Error Display Integration
**Decision Needed**: How to route batch validation errors from backend to specific UI components

#### 4. Batch Metadata Access
**Decision Needed**: How editors access batch metadata from upstream nodes for eligibility indication

### Suggested Next Steps for Minimal Batch v1 UI

1. **Phase 1**: Enable batch node inspector with key input and basic validation
2. **Phase 2**: Restore batch override foldouts with feature flag control
3. **Phase 3**: Implement error surfacing for batch-specific validation
4. **Phase 4**: Add batch eligibility indicators in object selection lists
5. **Phase 5**: Complete per-field override management with persistence

### Technical Readiness Assessment

**High Confidence Areas**:
- Node data structures support batch overrides
- Backend batch system is complete and tested
- UI patterns for per-object overrides are established

**Medium Risk Areas**:
- Integration between editor UI and batch metadata flow
- Error propagation from backend to specific UI components
- Performance impact of batch override calculations in UI

**Low Confidence Areas**:
- Real-time preview integration (not required for v1)
- Cross-editor consistency for batch override UI patterns
