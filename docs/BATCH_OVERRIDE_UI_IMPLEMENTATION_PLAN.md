# Batch Override UI Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for the batch override UI system. The backend infrastructure is already fully implemented and working. This plan covers only the missing UI components needed to provide users with an interface for managing per-object and per-key property overrides in batch scenarios.

## Reasoning: What UI Components Are Missing

### Current State Analysis

The existing codebase has:

- ✅ **Data Structure**: `node.data.batchOverridesByField[fieldPath][objectId][key]` fully implemented
- ✅ **Backend Resolution**: Complete precedence logic in `batch-overrides-resolver.ts`
- ✅ **Batch Key Management**: Working `BatchNode` component with key input modal
- ✅ **Object Detection**: `FlowTracker.getUpstreamObjects()` provides upstream object list
- ✅ **Field Integration Points**: All editors have established patterns for field components

### Missing UI Components

1. **Batch Button** (`🏷️`) - Visual indicator and entry point for batch editing
2. **Batch Modal** - Comprehensive interface for per-object and per-key editing
3. **Helper Functions** - Utilities for batch key detection and management
4. **Field State Management** - Logic to show/hide batch UI elements appropriately

### Why These Components Are Needed

1. **User Experience Gap**: Users can create batch keys but have no way to set per-key property overrides
2. **Data Inconsistency**: Batch override data exists but cannot be edited through the UI
3. **Feature Completeness**: The backend supports batch overrides but the UI is incomplete
4. **Workflow Efficiency**: Manual node data manipulation is required instead of intuitive UI controls

## Proposed Implementation

### 1. Core Components

#### 1.1 BatchButton Component

**Location**: `src/components/ui/batch-button.tsx`

**Purpose**: Visual indicator that appears next to supported fields when batch keys are available upstream.

**Props**:

```typescript
interface BatchButtonProps {
  nodeId: string;
  fieldPath: string; // e.g., "Canvas.position.x", "Typography.content"
  objectId?: string; // For per-object overrides
  className?: string;
}
```

**Behavior**:

- Shows only when upstream objects have batch keys attached
- Opens BatchModal when clicked
- Visual indicator: `🏷️` emoji or icon
- Tooltip: "Edit batch overrides for this field"

**Implementation Details**:

```typescript
// Detect batch keys using FlowTracker
const upstreamBatchKeys = useBatchKeysForField(nodeId, fieldPath);
const hasBatchKeys = upstreamBatchKeys.length > 0;

if (!hasBatchKeys) return null;

return (
  <button
    onClick={() => setModalOpen(true)}
    className="batch-button"
    title="Edit batch overrides"
  >
    🏷️
  </button>
);
```

#### 1.2 BatchModal Component

**Location**: `src/components/ui/batch-modal.tsx`

**Purpose**: Comprehensive interface for editing per-object and per-key property overrides.

**Props**:

```typescript
interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  fieldPath: string;
  objectId?: string;
  currentValue: unknown; // Current field value for fallbacks
  valueType: 'string' | 'number' | 'color' | 'boolean';
  onValueChange: (value: unknown) => void;
}
```

**Layout Structure**:

```
┌─ Batch Overrides: Canvas.position.x ──────────────────────────┐
│ ┌─ Left Column ─┬─ Right Column ──────────────────────────────┐ │
│ │ Default       │ [Value Editor] [Bind] [Clear]               │ │
│ │ Key "A"       │ [Value Editor] [Bind] [Clear]               │ │
│ │ Key "B"       │ [Value Editor] [Bind] [Clear]               │ │
│ │ Key "C"       │ [Value Editor] [Bind] [Clear]               │ │
│ │               │                                             │ │
│ │ [Add Key]     │ [Search/Filter for large key sets]         │ │
│ └───────────────┴─────────────────────────────────────────────┘ │
│                                                               │ │
│ [Save] [Cancel]                                               │ │
└───────────────────────────────────────────────────────────────┘
```

**Key Features**:

1. **Left Column - Key Rows**:
   - "Default (all keys)" row for per-object overrides
   - One row per upstream batch key
   - Virtualized list for >50 keys with search
   - Empty row = inherit from broader scope
   - Warning badge for orphaned keys (no longer upstream)

2. **Right Column - Value Editors**:
   - Context-aware editors (NumberField, TextField, ColorPicker, etc.)
   - Bind button per row (supports row-specific binding)
   - Clear/Reset action per row
   - Live preview of resolved values

3. **Modal Controls**:
   - Search/filter for large key sets
   - Batch operations (clear all, reset to defaults)
   - Validation feedback
   - Auto-save on change or explicit save/cancel

### 2. Helper Functions

#### 2.1 useBatchKeysForField Hook

**Location**: `src/hooks/use-batch-keys.ts`

**Purpose**: Detect available batch keys for a specific field on a specific node.

```typescript
interface BatchKeysResult {
  keys: string[];
  objectsWithKeys: string[]; // objectIds that have batch keys
  hasBatchKeys: boolean;
}

export function useBatchKeysForField(
  nodeId: string,
  fieldPath: string
): BatchKeysResult {
  // Implementation uses FlowTracker to find upstream batch nodes
  // Returns deduplicated list of keys from all upstream batch nodes
}
```

#### 2.2 getKeysForObject Helper

**Location**: `src/lib/batch/batch-helpers.ts`

**Purpose**: Get batch keys that apply to a specific object.

```typescript
export function getKeysForObject(
  nodeId: string,
  objectId: string,
  nodes: Node<NodeData>[],
  edges: Edge[]
): string[] {
  // Find upstream batch nodes from the current node
  // Check which batch nodes affect this specific object
  // Return applicable keys
}
```

#### 2.3 useBatchOverrides Hook

**Location**: `src/hooks/use-batch-overrides.ts`

**Purpose**: Manage batch override data for a specific field.

```typescript
interface BatchOverridesData {
  perObjectDefault?: unknown;
  perKeyOverrides: Record<string, unknown>;
}

export function useBatchOverrides(
  nodeId: string,
  fieldPath: string,
  objectId?: string
): {
  data: BatchOverridesData;
  setPerObjectDefault: (value: unknown) => void;
  setPerKeyOverride: (key: string, value: unknown) => void;
  clearOverride: (key?: string) => void; // undefined key = clear per-object
  hasOverrides: boolean;
} {
  // CRUD operations for batchOverridesByField data
}
```

### 3. Integration Points

#### 3.1 Field Component Integration

**Pattern Applied to All Supported Fields**:

```typescript
// Before (current pattern)
<NumberField
  label="Position X"
  value={getValue("position.x", 0)}
  onChange={(x) => onChange({ position: { x } })}
  bindAdornment={
    <BindButton
      nodeId={nodeId}
      bindingKey="position.x"
      objectId={objectId}
    />
  }
  disabled={isBound("position.x")}
/>

// After (proposed pattern)
<NumberField
  label="Position X"
  value={getValue("position.x", 0)}
  onChange={(x) => onChange({ position: { x } })}
  bindAdornment={
    <BindButton
      nodeId={nodeId}
      bindingKey="position.x"
      objectId={objectId}
    />
  }
  batchAdornment={
    <BatchButton
      nodeId={nodeId}
      fieldPath="Canvas.position.x"
      objectId={objectId}
    />
  }
  disabled={isBound("position.x")}
  readOnly={hasBatchOverrides("position.x")}
/>
```

**When Batch Overrides Exist**:

- Base input becomes read-only
- Show "Batch-managed (N keys)" badge
- Keep Bind button for node-level binding
- Keep Batch button for per-key editing

#### 3.2 Editor-Specific Integration

**Typography Editor** (`typography-editor-tab.tsx`):

- 8 integration points identified in architecture report
- Fields: content, fontFamily, fontSize, fontWeight, fontStyle, fillColor, strokeColor, strokeWidth

**Canvas Editor** (`canvas-editor-tab.tsx`):

- 9 integration points identified
- Fields: position.x/y, scale.x/y, rotation, opacity, fillColor, strokeColor, strokeWidth

**Media Editor** (`media-editor-tab.tsx`):

- 7 integration points identified
- Fields: imageAssetId, cropX/Y/Width/Height, displayWidth/Height

### 4. Data Flow Architecture

#### 4.1 Write Path (UI → Backend)

```
User Action → BatchModal → useBatchOverrides → updateFlow() → node.data.batchOverridesByField
                                                                      ↓
                                                            SceneAssembler → batch-overrides-resolver.ts
                                                                      ↓
                                                                 Render Pipeline
```

#### 4.2 Read Path (Backend → UI)

```
SceneAssembler → batch-overrides-resolver.ts → Resolved Values
    ↑
node.data.batchOverridesByField → useBatchOverrides → BatchModal
    ↑
updateFlow() ← BatchModal State
```

#### 4.3 State Synchronization

- **Immediate Updates**: Changes reflect immediately in property panels
- **Workspace Persistence**: `updateFlow()` ensures changes are saved to workspace
- **Cross-Editor Sync**: Changes in one editor reflect in others via shared node data

### 5. Edge Cases and Error Handling

#### 5.1 Orphaned Keys

- **Scenario**: Batch key deleted after per-key override set
- **UI Response**: Show warning badge + "Remove" button
- **Auto-Cleanup**: Option to remove orphaned overrides

#### 5.2 Conflicting Bindings

- **Scenario**: Both node-level binding and per-key overrides exist
- **Resolution**: Node-level binding takes precedence (existing behavior)
- **UI Indication**: Disable batch editing when node-level binding active

#### 5.3 Large Key Sets

- **Threshold**: >50 keys triggers virtualized list
- **Performance**: Search/filter functionality
- **UX**: Collapsible sections, pagination if needed

#### 5.4 Type Validation

- **Scenario**: Invalid value type for field (string in number field)
- **UI Response**: Validation error with suggestion
- **Fallback**: Revert to last valid value

#### 5.5 Concurrent Editing

- **Scenario**: Multiple editors open simultaneously
- **Resolution**: Last-write-wins via `updateFlow()`
- **UX**: Real-time sync across editor instances

### 6. Testing Strategy

#### 6.1 Unit Tests

**Component Tests**:

- `BatchButton.test.tsx` - Visibility logic, click handling
- `BatchModal.test.tsx` - Modal interactions, value editing
- `useBatchKeys.test.ts` - Key detection logic
- `useBatchOverrides.test.ts` - Data CRUD operations

**Helper Function Tests**:

- `batch-helpers.test.ts` - Key resolution algorithms
- FlowTracker integration tests

#### 6.2 Integration Tests

**Editor Integration**:

- Typography editor batch UI integration
- Canvas editor batch UI integration
- Media editor batch UI integration
- Cross-editor synchronization

**Data Flow Tests**:

- UI changes propagate to node data
- Node data changes reflect in UI
- Scene assembler receives correct override data
- Render pipeline applies overrides correctly

#### 6.3 End-to-End Tests

**Workflow Tests**:

- Complete batch override workflow
- Multi-key override scenarios
- Binding + batch override interactions
- Error recovery scenarios

### 7. Implementation Phases

#### Phase 1: Core Infrastructure (Week 1)

- [ ] `BatchButton` component
- [ ] `useBatchKeysForField` hook
- [ ] `getKeysForObject` helper
- [ ] Basic modal skeleton

#### Phase 2: Modal Functionality (Week 2)

- [ ] Complete `BatchModal` component
- [ ] `useBatchOverrides` hook
- [ ] Value editors integration
- [ ] Search/filter for large key sets

#### Phase 3: Editor Integration (Week 3)

- [ ] Typography editor integration (8 fields)
- [ ] Canvas editor integration (9 fields)
- [ ] Media editor integration (7 fields)
- [ ] Cross-editor testing

#### Phase 4: Polish and Edge Cases (Week 4)

- [ ] Error handling and validation
- [ ] Orphaned key management
- [ ] Performance optimization
- [ ] Accessibility improvements

### 8. Success Criteria

#### Functional Requirements

- [ ] Batch button appears when upstream objects have batch keys
- [ ] Modal opens with correct key list and current values
- [ ] Per-key and per-object overrides can be set
- [ ] Changes persist to workspace and reflect in render
- [ ] Existing binding system remains unaffected

#### Performance Requirements

- [ ] Modal opens in <100ms for key sets up to 100 items
- [ ] Search/filter works smoothly for 1000+ keys
- [ ] No impact on existing editor performance

#### UX Requirements

- [ ] Intuitive workflow for batch override management
- [ ] Clear visual indicators for batch-managed fields
- [ ] Helpful error messages and validation feedback
- [ ] Consistent with existing editor patterns

#### Compatibility Requirements

- [ ] No breaking changes to existing functionality
- [ ] Backward compatible with existing workspaces
- [ ] Works with all supported field types
- [ ] Integrates seamlessly with existing binding system

### 9. Risk Assessment and Mitigation

#### High Risk

- **Data Corruption**: Risk of corrupting existing override data
  - _Mitigation_: Comprehensive testing, data validation, backup mechanisms

- **Performance Impact**: Large key sets could slow down editors
  - _Mitigation_: Virtualized lists, pagination, lazy loading

#### Medium Risk

- **UI Complexity**: Modal could become confusing with many keys
  - _Mitigation_: Progressive disclosure, search/filter, clear information hierarchy

- **State Synchronization**: Changes not reflecting across editors
  - _Mitigation_: Leverage existing `updateFlow()` mechanism, add sync validation

#### Low Risk

- **Type Safety**: TypeScript integration with existing codebase
  - _Mitigation_: Strict typing, comprehensive type guards

- **Styling Consistency**: Matching existing editor visual design
  - _Mitigation_: Reuse existing UI components and design tokens

### 10. Future Enhancements

#### Short Term (Post-Launch)

- **Bulk Operations**: Select multiple keys for batch editing
- **Import/Export**: Batch override templates
- **Visual Diff**: Show before/after preview of overrides

#### Long Term

- **Advanced Key Management**: Key groups, hierarchies
- **Override Templates**: Reusable override configurations
- **Collaborative Editing**: Real-time override collaboration
- **AI-Assisted Overrides**: Smart suggestions for batch values

---

## Conclusion

This implementation plan provides a complete, production-ready specification for the batch override UI system. The backend compatibility has been verified, and the plan focuses exclusively on the missing UI components needed to complete the feature.

The implementation follows established patterns in the codebase, maintains backward compatibility, and provides a comprehensive user experience for managing batch property overrides.

**Total Implementation Effort**: 4 weeks
**Risk Level**: Low (backend is solid, UI follows existing patterns)
**Compatibility**: 100% with existing backend infrastructure
