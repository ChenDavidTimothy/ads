import { useCallback, useMemo } from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { 
  type GranularOverrides, 
  type GranularObjectAssignments,
  type GranularPerObjectAssignments,
  convertLegacyToGranular,
  mergeGranularOverrides
} from '@/shared/properties/granular-assignments';

export interface UnifiedPropertyManager {
  // Get current overrides for an object (or global)
  getOverrides: (objectId?: string) => GranularOverrides | undefined;
  
  // Update a single field override
  updateFieldOverride: (fieldPath: string, value: any, objectId?: string) => void;
  
  // Clear a single field override
  clearFieldOverride: (fieldPath: string, objectId?: string) => void;
  
  // Clear all overrides for an object
  clearAllOverrides: (objectId?: string) => void;
  
  // Get effective value for a field (considering bindings, overrides, and defaults)
  getEffectiveValue: <T>(fieldPath: string, defaultValue: T, objectId?: string) => T;
  
  // Check if a field is overridden
  isFieldOverridden: (fieldPath: string, objectId?: string) => boolean;
  
  // Check if a field is bound
  isFieldBound: (fieldPath: string, objectId?: string) => boolean;
  
  // Get all bound values from result nodes
  getBoundValues: () => Record<string, any>;
}

export function useUnifiedProperties(nodeId: string): UnifiedPropertyManager {
  const { state, updateFlow } = useWorkspace();
  
  // Find the current node
  const currentNode = useMemo(() => {
    return state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
  }, [state.flow.nodes, nodeId]);
  
  // Get current assignments (convert from legacy if needed)
  const currentAssignments = useMemo((): GranularPerObjectAssignments => {
    const nodeData = currentNode?.data;
    if (!nodeData) return {};
    
    // Check if we have new granular assignments
    if (nodeData.granularPerObjectAssignments) {
      return nodeData.granularPerObjectAssignments as GranularPerObjectAssignments;
    }
    
    // Convert legacy assignments
    const legacyAssignments = nodeData.perObjectAssignments as any;
    if (!legacyAssignments) return {};
    
    const granular: GranularPerObjectAssignments = {};
    for (const [objectId, assignment] of Object.entries(legacyAssignments)) {
      const legacyInitial = (assignment as any)?.initial;
      if (legacyInitial) {
        granular[objectId] = {
          initial: convertLegacyToGranular(legacyInitial)
        };
      }
    }
    return granular;
  }, [currentNode]);
  
  // Get current bindings
  const currentBindings = useMemo(() => {
    return {
      global: (currentNode?.data?.variableBindings ?? {}) as Record<string, { boundResultNodeId?: string }>,
      byObject: (currentNode?.data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { boundResultNodeId?: string }>>
    };
  }, [currentNode]);
  
  // Get bound values from result nodes
  const getBoundValues = useCallback((): Record<string, any> => {
    // TODO: Implement when we have access to execution context
    // For now, return empty object
    return {};
  }, []);
  
  // Update the flow with new assignments
  const updateAssignments = useCallback((newAssignments: GranularPerObjectAssignments) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (((n as any).data?.identifier?.id) !== nodeId) return n;
        return {
          ...n,
          data: {
            ...(n as any).data,
            granularPerObjectAssignments: newAssignments
          }
        } as any;
      })
    });
  }, [state.flow.nodes, nodeId, updateFlow]);
  
  const getOverrides = useCallback((objectId?: string): GranularOverrides | undefined => {
    if (objectId) {
      return currentAssignments[objectId]?.initial;
    }
    // For global overrides, we can store them under a special key or in node data directly
    return currentNode?.data?.granularOverrides as GranularOverrides | undefined;
  }, [currentAssignments, currentNode]);
  
  const updateFieldOverride = useCallback((fieldPath: string, value: any, objectId?: string) => {
    if (objectId) {
      // Per-object override
      const newAssignments: GranularPerObjectAssignments = { ...currentAssignments };
      const currentObj = newAssignments[objectId] || { initial: {} };
      const newInitial = { ...(currentObj.initial || {}), [fieldPath]: value };
      
      newAssignments[objectId] = {
        ...currentObj,
        initial: newInitial
      };
      
      updateAssignments(newAssignments);
    } else {
      // Global override (stored directly on node)
      const currentGlobal = currentNode?.data?.granularOverrides as GranularOverrides | undefined;
      const newGlobal = { ...(currentGlobal || {}), [fieldPath]: value };
      
      updateFlow({
        nodes: state.flow.nodes.map((n) => {
          if (((n as any).data?.identifier?.id) !== nodeId) return n;
          return {
            ...n,
            data: {
              ...(n as any).data,
              granularOverrides: newGlobal
            }
          } as any;
        })
      });
    }
  }, [currentAssignments, currentNode, nodeId, state.flow.nodes, updateFlow, updateAssignments]);
  
  const clearFieldOverride = useCallback((fieldPath: string, objectId?: string) => {
    if (objectId) {
      const newAssignments: GranularPerObjectAssignments = { ...currentAssignments };
      const currentObj = newAssignments[objectId];
      if (!currentObj?.initial) return;
      
      const newInitial = { ...currentObj.initial };
      delete newInitial[fieldPath];
      
      if (Object.keys(newInitial).length === 0) {
        // Remove the entire object if no overrides left
        delete newAssignments[objectId];
      } else {
        newAssignments[objectId] = {
          ...currentObj,
          initial: newInitial
        };
      }
      
      updateAssignments(newAssignments);
    } else {
      const currentGlobal = currentNode?.data?.granularOverrides as GranularOverrides | undefined;
      if (!currentGlobal || currentGlobal[fieldPath] === undefined) return;
      
      const newGlobal = { ...currentGlobal };
      delete newGlobal[fieldPath];
      
      updateFlow({
        nodes: state.flow.nodes.map((n) => {
          if (((n as any).data?.identifier?.id) !== nodeId) return n;
          return {
            ...n,
            data: {
              ...(n as any).data,
              granularOverrides: Object.keys(newGlobal).length > 0 ? newGlobal : undefined
            }
          } as any;
        })
      });
    }
  }, [currentAssignments, currentNode, nodeId, state.flow.nodes, updateFlow, updateAssignments]);
  
  const clearAllOverrides = useCallback((objectId?: string) => {
    if (objectId) {
      const newAssignments: GranularPerObjectAssignments = { ...currentAssignments };
      delete newAssignments[objectId];
      updateAssignments(newAssignments);
    } else {
      updateFlow({
        nodes: state.flow.nodes.map((n) => {
          if (((n as any).data?.identifier?.id) !== nodeId) return n;
          return {
            ...n,
            data: {
              ...(n as any).data,
              granularOverrides: undefined
            }
          } as any;
        })
      });
    }
  }, [currentAssignments, nodeId, state.flow.nodes, updateFlow, updateAssignments]);
  
  const getEffectiveValue = useCallback(<T>(fieldPath: string, defaultValue: T, objectId?: string): T => {
    // 1. Check if bound
    const bindings = objectId ? currentBindings.byObject[objectId] : currentBindings.global;
    const boundNodeId = bindings?.[fieldPath]?.boundResultNodeId;
    if (boundNodeId) {
      const boundValues = getBoundValues();
      if (boundValues[boundNodeId] !== undefined) {
        return boundValues[boundNodeId] as T;
      }
    }
    
    // 2. Check if overridden
    const overrides = getOverrides(objectId);
    if (overrides?.[fieldPath] !== undefined) {
      return overrides[fieldPath] as T;
    }
    
    // 3. Return default
    return defaultValue;
  }, [currentBindings, getBoundValues, getOverrides]);
  
  const isFieldOverridden = useCallback((fieldPath: string, objectId?: string): boolean => {
    const overrides = getOverrides(objectId);
    return overrides?.[fieldPath] !== undefined;
  }, [getOverrides]);
  
  const isFieldBound = useCallback((fieldPath: string, objectId?: string): boolean => {
    const bindings = objectId ? currentBindings.byObject[objectId] : currentBindings.global;
    return !!bindings?.[fieldPath]?.boundResultNodeId;
  }, [currentBindings]);
  
  return {
    getOverrides,
    updateFieldOverride,
    clearFieldOverride,
    clearAllOverrides,
    getEffectiveValue,
    isFieldOverridden,
    isFieldBound,
    getBoundValues
  };
}