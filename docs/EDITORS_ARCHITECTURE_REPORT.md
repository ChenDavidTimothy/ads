# Editors Architecture Report

## Table of Contents

1. [Component/File Map Per Editor](#componentfile-map-per-editor)
   - [Typography Editor](#typography-editor)
   - [Canvas Editor](#canvas-editor)
   - [Media Editor](#media-editor)
   - [Animation/Timeline Editor](#animationtimeline-editor)

2. [Field Rendering Pipeline](#field-rendering-pipeline)
   - [Schema Definition](#schema-definition)
   - [Value Resolution](#value-resolution)
   - [Typography.content Example](#typographycontent-example)
   - [Canvas.position.x Example](#canvaspositionx-example)
   - [Media.imageAssetId Example](#mediaimageassetid-example)

3. [Overrides and Precedence](#overrides-and-precedence)
   - [Per-Object Overrides](#per-object-overrides)
   - [Default Overrides](#default-overrides)
   - [Precedence Rules](#precedence-rules)

4. [Binding System](#binding-system)
   - [UI Flow](#ui-flow)
   - [Data Storage](#data-storage)
   - [Disabled State Logic](#disabled-state-logic)
   - [Badge Rendering](#badge-rendering)

5. [Batch Reachability and Metadata](#batch-reachability-and-metadata)
   - [Batch Metadata Types](#batch-metadata-types)
   - [Editor Integration](#editor-integration)
   - [Object Reachability](#object-reachability)

6. [Feature Flags](#feature-flags)

7. [Persistence/Serialization](#persistenceserialization)
   - [Node Data Storage](#node-data-storage)
   - [Workspace Serialization](#workspace-serialization)
   - [Migration Points](#migration-points)

8. [Scene/Render Interaction](#scenerender-interaction)
   - [Data Collection](#data-collection)
   - [Scene Assembly](#scene-assembly)
   - [Render Pipeline](#render-pipeline)

9. [Mount Points and Risks](#mount-points-and-risks)
   - [Typography Editor](#typography-editor-1)
   - [Canvas Editor](#canvas-editor-1)
   - [Media Editor](#media-editor-1)
   - [Animation Editor](#animation-editor-1)
   - [Risk Assessment](#risk-assessment)

## Component/File Map Per Editor

### Typography Editor

**Main Components:**
- `src/components/workspace/typography-editor-tab.tsx` - Main editor component
- `src/components/workspace/binding/bindings.tsx` - Binding system components
- `src/components/ui/form-fields.tsx` - Form field components

**Component Tree:**
```
TypographyEditorTab
├── TypographyDefaultProperties (center panel)
│   ├── TextareaField (content)
│   ├── SelectField (fontFamily, fontWeight, fontStyle)
│   ├── NumberField (fontSize, strokeWidth)
│   └── ColorField (fillColor, strokeColor)
├── TypographyPerObjectProperties (right panel)
│   ├── Same field components as above
│   └── TypographyBindingBadge/TypographyOverrideBadge
└── SelectionList (left sidebar - text objects)
```

**Shared Components:**
- `src/components/ui/selection.tsx` - SelectionList for object selection
- `src/components/ui/badge.tsx` - Binding/override badges
- `src/components/workspace/binding/badges.tsx` - Unified badge components

**Hooks/Stores:**
- `useWorkspace()` - Main workspace state management
- `useVariableBinding()` - Binding system logic
- `FlowTracker` - Object detection and flow analysis

### Canvas Editor

**Main Components:**
- `src/components/workspace/canvas-editor-tab.tsx` - Main editor component

**Component Tree:**
```
CanvasEditorTab
├── CanvasDefaultProperties (center panel)
│   ├── NumberField (position.x/y, scale.x/y, rotation, opacity)
│   └── ColorField (fillColor, strokeColor)
├── CanvasPerObjectProperties (right panel)
│   ├── Same field components as above
│   └── CanvasBindingBadge/OverrideBadge
└── SelectionList (left sidebar - all objects)
```

**Shared Components:**
- Same as Typography Editor

### Media Editor

**Main Components:**
- `src/components/workspace/media-editor-tab.tsx` - Main editor component
- `src/components/workspace/media/asset-selection-modal.tsx` - Asset selection

**Component Tree:**
```
MediaEditorTab
├── MediaDefaultProperties (center panel)
│   ├── Asset display/selection UI
│   ├── NumberField (cropX/Y/Width/Height, displayWidth/Height)
│   └── MediaBindingBadge
├── MediaPerObjectProperties (right panel)
│   ├── Same components as above
│   └── Asset override UI
└── SelectionList (left sidebar - image objects)
```

**Shared Components:**
- Same as Typography Editor
- `api.assets.list` - Asset API integration

### Animation/Timeline Editor

**Main Components:**
- `src/components/workspace/timeline-editor-tab.tsx` - Main editor component
- `src/components/workspace/timeline-editor-core.tsx` - Timeline visualization

**Component Tree:**
```
TimelineEditorTab
├── TimelineEditorCore (center panel)
│   ├── Track rendering and interaction
│   └── Timeline visualization
├── TrackProperties (right panel)
│   ├── Property editors for selected track
│   └── Override UI
└── SelectionList (left sidebar - all objects)
```

**Shared Components:**
- `src/components/workspace/timeline-editor-core.tsx` - TimelineEditorCore component

## Field Rendering Pipeline

### Schema Definition

Field schemas are defined in the node registry system:

```typescript
// src/shared/types/definitions.ts - Node definitions with property schemas
export interface NodeDefinition {
  type: string;
  label: string;
  properties: {
    properties: PropertyDefinition[];
  };
  defaults: Record<string, unknown>;
  // ...
}
```

Node definitions are registered in `NODE_DEFINITIONS` and accessed via:
```typescript
// src/shared/registry/registry-utils.ts
export function getNodeDefinition(nodeType: string): NodeDefinition | undefined
export function getNodeDefaults(nodeType: string): Record<string, unknown> | undefined
```

### Value Resolution

Value resolution follows a 3-tier precedence system:
1. **Per-object overrides** (highest priority)
2. **Node-level defaults** (medium priority)
3. **Definition defaults** (lowest priority)

**Resolution Logic (Typography.content example):**

```typescript
// src/components/workspace/typography-editor-tab.tsx:129
const content = data.content ?? def.content ?? "Sample Text";
```

### Typography.content Example

**Schema Definition:**
```typescript
// From node definitions - Typography node has content property
defaults: {
  content: "Sample Text",
  // ... other defaults
}
```

**Value Resolution Path:**
```129:129:src/components/workspace/typography-editor-tab.tsx
const content = data.content ?? def.content ?? "Sample Text";
```

**Per-Object Override Resolution:**
```498:502:src/components/workspace/typography-editor-tab.tsx
const fontFamily =
  initial.fontFamily ?? base.fontFamily ?? def.fontFamily ?? "Arial";
const fontSize = initial.fontSize ?? base.fontSize ?? def.fontSize ?? 24;
```

**Field Rendering:**
```596:611:src/components/workspace/typography-editor-tab.tsx
<TextareaField
  label="Content"
  value={getValue("content", "Sample Text") as string}
  onChange={(content) => onChange({ content })}
  rows={4}
  bindAdornment={
    <BindButton
      nodeId={nodeId}
      bindingKey="content"
      objectId={objectId}
    />
  }
  disabled={isBound("content")}
  inputClassName={leftBorderClass("content")}
/>
```

### Canvas.position.x Example

**Schema Definition:**
```typescript
// Canvas node defaults
defaults: {
  position: { x: 0, y: 0 },
  // ... other defaults
}
```

**Value Resolution Path:**
```331:332:src/components/workspace/canvas-editor-tab.tsx
const posX = data.position?.x ?? def.position?.x ?? 0;
const posY = data.position?.y ?? def.position?.y ?? 0;
```

**Per-Object Override Resolution:**
```812:817:src/components/workspace/canvas-editor-tab.tsx
case "position.x":
  return (
    initial.position?.x ??
    base.position?.x ??
    def.position?.x ??
    fallbackValue
  );
```

**Field Rendering:**
```888:906:src/components/workspace/canvas-editor-tab.tsx
<NumberField
  label=""
  value={getValue("position.x", 0)}
  onChange={(x) => onChange({ position: { x } })}
  defaultValue={0}
  bindAdornment={
    <BindButton
      nodeId={nodeId}
      bindingKey="position.x"
      objectId={objectId}
    />
  }
  disabled={isBound("position.x")}
  inputClassName={leftBorderClass("position.x")}
/>
```

### Media.imageAssetId Example

**Schema Definition:**
```typescript
// Media node defaults
defaults: {
  imageAssetId: "",
  // ... other defaults
}
```

**Value Resolution Path:**
```75:75:src/components/workspace/media-editor-tab.tsx
const imageAssetId: string = data?.imageAssetId ?? defImageAssetId;
```

**Per-Object Override Resolution:**
```507:514:src/components/workspace/media-editor-tab.tsx
case "imageAssetId":
  return (
    initial.imageAssetId ??
    base.imageAssetId ??
    defImageAssetId ??
    fallbackValue
  );
```

**Field Rendering:**
```592:611:src/components/workspace/media-editor-tab.tsx
<AssetSelectionModal
  isOpen={showAssetModal}
  onClose={() => setShowAssetModal(false)}
  onSelect={handleAssetSelect}
  selectedAssetId={
    currentAssetId && currentAssetId !== "" ? currentAssetId : undefined
  }
/>
```

## Overrides and Precedence

### Per-Object Overrides

**Data Structures:**
```typescript
// src/shared/properties/assignments.ts
export interface ObjectAssignments {
  initial?: ObjectInitialOverrides;  // Static property overrides
  tracks?: TrackOverride[];         // Animation track overrides
}

export interface ObjectInitialOverrides {
  position?: Point2D;
  rotation?: number;
  scale?: Point2D;
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  [key: string]: unknown;  // Extensible for other properties
}

export type PerObjectAssignments = Record<string, ObjectAssignments>;
```

**Storage Location:**
- Stored in `node.data.perObjectAssignments` for each editor node
- Keyed by `objectId` (upstream object identifier)

### Default Overrides

**Node-Level Defaults:**
- Stored directly in `node.data` properties
- Override definition defaults but are overridden by per-object assignments

### Precedence Rules

**Complete Precedence Chain:**
1. **Per-object binding** (highest - disables manual input)
2. **Per-object manual override** (initial values)
3. **Node-level binding** (disables input for all objects)
4. **Node-level manual values**
5. **Definition defaults** (lowest)

**Precedence Implementation:**
```804:823:src/components/workspace/canvas-editor-tab.tsx
const getValue = (key: string, fallbackValue: number | string) => {
  // Check per-object binding first (highest priority)
  if (isBound(key)) return undefined; // Blank when bound

  // Check manual override second (if not bound)
  switch (key) {
    case "position.x":
      return (
        initial.position?.x ??
        base.position?.x ??
        def.position?.x ??
        fallbackValue
      );
    // ... other cases
  }
};
```

## Binding System

### UI Flow

**Binding Creation:**
1. User clicks bind button next to field
2. `BindButton` opens modal with available Result variables
3. User selects Result node from filtered list
4. `bind()` function updates node data with binding reference

**Binding UI Components:**
```376:473:src/components/workspace/binding/bindings.tsx
export function BindButton({ ... }) {
  // Modal-based variable selection
  // Search/filter functionality
  // Bind action triggers updateFlow
}
```

### Data Storage

**Binding Reference Structure:**
```typescript
// Node-level bindings
node.data.variableBindings = {
  [bindingKey]: {
    target: string,        // e.g., "position.x"
    boundResultNodeId: string  // Result node identifier
  }
}

// Per-object bindings
node.data.variableBindingsByObject = {
  [objectId]: {
    [bindingKey]: {
      target: string,
      boundResultNodeId: string
    }
  }
}
```

**Storage Location:**
- `node.data.variableBindings` - Global bindings (apply to all objects)
- `node.data.variableBindingsByObject` - Per-object bindings (override global)

### Disabled State Logic

**Binding Detection:**
```767:771:src/components/workspace/canvas-editor-tab.tsx
const isBound = (key: string) => {
  const vbAll = node?.data?.variableBindingsByObject ?? {};
  return !!vbAll?.[objectId]?.[key]?.boundResultNodeId;
};
```

**Field Disabling:**
```904:904:src/components/workspace/canvas-editor-tab.tsx
disabled={isBound("position.x")}
```

### Badge Rendering

**Binding Badge:**
```22:52:src/components/workspace/canvas-editor-tab.tsx
function CanvasBindingBadge({ ... }) {
  // Shows "Bound: {resultName}" or "Bound"
  // Includes remove button for unbinding
}
```

**Override Badge:**
```55:71:src/components/workspace/canvas-editor-tab.tsx
function OverrideBadge({ ... }) {
  // Shows "Manual" with remove button
  // Uses unified badge component
}
```

**Badge Display Logic:**
```908:927:src/components/workspace/canvas-editor-tab.tsx
{(isOverridden("position.x") || isBound("position.x")) && (
  <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
    <div className="flex items-center gap-[var(--space-1)]">
      {isOverridden("position.x") && !isBound("position.x") && (
        <OverrideBadge ... />
      )}
      {isBound("position.x") && (
        <CanvasBindingBadge ... />
      )}
    </div>
  </div>
)}
```

## Batch Reachability and Metadata

### Batch Metadata Types

**Batch Override Types:**
```typescript
// src/server/animation-processing/scene/batch-overrides-resolver.ts
export type PerObjectBatchOverrides = Record<
  string, // objectId
  Record<
    string, // fieldPath (e.g., "Canvas.position.x")
    Record<string, unknown> // { [batchKey | "default"]: value }
  >
>;

export type PerObjectBoundFields = Record<string, string[]>; // objectId -> fieldPaths
```

**Batch Resolve Context:**
```16:19:src/server/animation-processing/scene/batch-overrides-resolver.ts
export interface BatchResolveContext {
  batchKey: string | null;
  perObjectBatchOverrides?: PerObjectBatchOverrides;
  perObjectBoundFields?: PerObjectBoundFields;
}
```

### Editor Integration

**Current State:** Not found
- No direct integration with batch metadata in editor components
- Batch overrides UI feature flag is disabled
- Backend batch resolution exists but editors don't read batch metadata

### Object Reachability

**FlowTracker Integration:**
```90:111:src/components/workspace/canvas-editor-tab.tsx
const upstreamObjects = useMemo(() => {
  const tracker = new FlowTracker();

  const objectDescriptors = tracker.getUpstreamObjects(
    nodeId,
    state.flow.nodes,
    state.flow.edges,
  );

  return objectDescriptors.map((obj) => ({
    data: {
      identifier: {
        id: obj.id,
        displayName: obj.displayName,
        type: obj.type,
      },
    },
    type: obj.type,
  }));
}, [nodeId, state.flow.nodes, state.flow.edges]);
```

## Feature Flags

**Editor-Related Flags:**
```typescript
// src/shared/feature-flags.ts
export const features = {
  // Batch overrides editor UI foldouts (Canvas/Typography/Media)
  // Disabled by default; backend functionality remains enabled.
  batchOverridesUI: false,
} as const;
```

**Usage Sites:**
- Not currently used in codebase (flag is false)
- Intended to control batch overrides UI in editors
- Backend batch resolution works regardless of flag

## Persistence/Serialization

### Node Data Storage

**Editor State Storage:**
```typescript
// Node data structure for editors
interface TypographyNodeData extends BaseNodeData {
  // Typography properties
  content?: string;
  fontFamily: string;
  fontSize: number;
  // ... other properties

  // Override system
  perObjectAssignments?: PerObjectAssignments;

  // Binding system
  variableBindings?: Record<string, { target?: string; boundResultNodeId?: string }>;
  variableBindingsByObject?: Record<string, Record<string, { ... }>>;
}
```

**Timeline Editor Storage:**
- Timeline data stored separately in `state.editors.timeline[nodeId]`
- Merged into node data during serialization

### Workspace Serialization

**Merge Process:**
```96:121:src/utils/workspace-state.ts
export function mergeEditorsIntoFlow(state: WorkspaceState): {
  nodes: Node<NodeData>[];
  edges: Edge[];
} {
  const nodes = state.flow.nodes.map((node) => {
    if (node.type === "animation") {
      const nodeId = node?.data?.identifier?.id;
      if (nodeId) {
        const timelineData = state.editors.timeline[nodeId];
        if (timelineData) {
          return {
            ...node,
            data: {
              ...node.data,
              duration: timelineData.duration,
              tracks: timelineData.tracks,
            } as NodeData,
          } as Node<NodeData>;
        }
      }
    }
    return node;
  });

  return { nodes, edges: state.flow.edges };
}
```

### Migration Points

**Data Structure Changes:**
- Adding `batchOverridesByField` to node data would require migration
- `perObjectAssignments` structure changes need careful migration
- Binding system structure changes impact all editors

**Migration Strategy:**
- Node data migrations in `extractWorkspaceState()` function
- Version-based migration logic in workspace loading
- Backward compatibility for existing workspaces

## Scene/Render Interaction

### Data Collection

**Editor Data Flow:**
1. Editors modify `node.data` properties
2. `updateFlow()` persists changes to workspace state
3. Scene assembler reads node data during rendering
4. Backend processes node data into scene objects

**Scene Assembly Input:**
```typescript
// Editors provide data to scene assembler
node.data = {
  // Typography properties
  content: string;
  fontFamily: string;
  fontSize: number;

  // Override system
  perObjectAssignments: PerObjectAssignments;

  // Binding system
  variableBindings: Record<...>;
  variableBindingsByObject: Record<...>;
}
```

### Scene Assembly

**Data Reading Pattern:**
```251:252:src/server/animation-processing/scene/scene-assembler.ts
const overrides = perObjectAssignments?.[objectId]?.tracks;
const override = pickOverridesForTrack(overrides, track);
```

**Override Application:**
```98:142:src/server/animation-processing/scene/scene-assembler.ts
function applyTrackOverride(
  base: AnimationTrack,
  override: TrackOverride,
): AnimationTrack {
  // Deep merge override properties
  const mergedProps: Record<string, unknown> = {
    ...baseProps,
    ...overrideProps,
  };

  // Deep-merge nested 'from'/'to' objects
  if (typeof baseProps.from === "object" && typeof overrideProps.from === "object") {
    mergedProps.from = { ...baseProps.from, ...overrideProps.from };
  }
  // ...
}
```

### Render Pipeline

**No Direct Scene Preview Dependency:**
- Confirmed: editors do not depend on Scene preview
- Render pipeline is separate from editor UI
- Scene data flows: Editor → Node Data → Scene Assembler → Render

**Data Flow Summary:**
```
Editor UI → updateFlow() → node.data → SceneAssembler → Render Pipeline
```

## Mount Points and Risks

### Typography Editor

**Per-Field Drawer Mount Points:**
- **Location:** `src/components/workspace/typography-editor-tab.tsx`
- **TypographyDefaultProperties component:** Lines 145-396
- **TypographyPerObjectProperties component:** Lines 400-905
- **Exact insertion point:** After each field component, before badge rendering

**Specific Mount Points:**
- Content field: After line 181 (`</div>`)
- Font Family: After line 213 (`</div>`)
- Font Size: After line 243 (`</div>`)
- Font Weight: After line 271 (`</div>`)
- Font Style: After line 293 (`</div>`)
- Fill Color: After line 329 (`</div>`)
- Stroke Color: After line 359 (`</div>`)
- Stroke Width: After line 393 (`</div>`)

### Canvas Editor

**Per-Field Drawer Mount Points:**
- **Location:** `src/components/workspace/canvas-editor-tab.tsx`
- **CanvasDefaultProperties component:** Lines 294-695
- **CanvasPerObjectProperties component:** Lines 698-1283

**Specific Mount Points:**
- Position X: After line 404 (`</div>`)
- Position Y: After line 445 (`</div>`)
- Scale X: After line 485 (`</div>`)
- Scale Y: After line 525 (`</div>`)
- Rotation: After line 556 (`</div>`)
- Opacity: After line 590 (`</div>`)
- Fill Color: After line 622 (`</div>`)
- Stroke Color: After line 650 (`</div>`)
- Stroke Width: After line 682 (`</div>`)

### Media Editor

**Per-Field Drawer Mount Points:**
- **Location:** `src/components/workspace/media-editor-tab.tsx`
- **MediaDefaultProperties component:** Lines 57-456
- **MediaPerObjectProperties component:** Lines 459-981

**Specific Mount Points:**
- Image Asset: After line 246 (`</div>`)
- Crop X: After line 283 (`</div>`)
- Crop Y: After line 310 (`</div>`)
- Crop Width: After line 343 (`</div>`)
- Crop Height: After line 370 (`</div>`)
- Display Width: After line 412 (`</div>`)
- Display Height: After line 439 (`</div>`)

### Animation Editor

**Per-Field Drawer Mount Points:**
- **Location:** `src/components/workspace/timeline-editor-core.tsx`
- **TrackProperties component:** Lines 22-356

**Specific Mount Points:**
- Track properties are rendered in `TrackProperties` component
- Mount points would be after each property field in the track editor

### Risk Assessment

**Low-Risk Patterns:**
- All editors follow consistent component structure
- Badge rendering already exists as insertion pattern
- No conflicts with existing drawer/modal systems
- Form field components are self-contained

**Medium-Risk Patterns:**
- Deep-merge logic in `mergeObjectAssignments()` could conflict if per-key overrides introduce new nesting
- Binding reset paths in `resetToDefault()` might need updates for per-key override cleanup
- Animation track override merging might need extension for per-key values

**High-Risk Areas:**
- Timeline editor has separate state management (`state.editors.timeline`)
- Scene assembler deep-merge logic for track properties
- Migration points for adding batch override data structures

## Summary: Exact Implementation Plan

### Components to Modify

1. **Batch Node Inspector Key Input** (`src/components/workspace/nodes/batch-node.tsx`)
   - Add key input field to batch node UI
   - Integrate with existing key management system

2. **Per-Field Drawer Mount Points**
   - Typography Editor: 8 mount points (content, fontFamily, fontSize, fontWeight, fontStyle, fillColor, strokeColor, strokeWidth)
   - Canvas Editor: 9 mount points (position.x/y, scale.x/y, rotation, opacity, fillColor, strokeColor, strokeWidth)
   - Media Editor: 7 mount points (imageAssetId, cropX/Y/Width/Height, displayWidth/Height)
   - Animation Editor: Track property mount points in TrackProperties component

### Error Surfacing Strategy

- Use existing toast/notification system for batch-related errors
- Add validation in drawer components for invalid per-key values
- Surface batch key conflicts and missing key errors

### Next Steps

1. **Immediate (Low Risk):**
   - Implement batch key input in BatchNode component
   - Create shared PerKeyOverridesDrawer component
   - Add feature flag check for drawer visibility

2. **Short Term (Medium Risk):**
   - Integrate drawer into Typography editor mount points
   - Test with existing per-object override system
   - Add validation and error handling

3. **Long Term (Higher Risk):**
   - Extend to Canvas and Media editors
   - Update scene assembler for per-key resolution
   - Add migration logic for batch override data structures
   - Test with animation timeline overrides

### Blockers/Ambiguities

1. **Timeline Editor Complexity:** Separate state management requires careful integration
2. **Deep Merge Conflicts:** Animation track property merging needs verification
3. **Migration Strategy:** Adding batchOverridesByField requires migration planning
4. **Feature Flag Usage:** Current batchOverridesUI flag is unused - verify intended behavior

### Success Criteria

- Per-key drawer appears on supported fields without UI conflicts
- Batch key input integrates with existing batch node UI
- No regressions in existing per-object override functionality
- Clean separation between per-object and per-key override systems
