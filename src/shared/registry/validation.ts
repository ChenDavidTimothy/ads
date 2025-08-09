// src/shared/registry/validation.ts - Runtime validation for node registration
import { NODE_DEFINITIONS } from '../types/definitions';
import { getNodeComponentMapping } from './registry-utils';
import { EXECUTOR_NODE_MAPPINGS } from '../../server/animation-processing/executors/generated-mappings';
import { logger } from '@/lib/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Validate complete node registration
export function validateNodeRegistration(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate component mappings
    const componentValidation = validateComponentMappings();
    errors.push(...componentValidation.errors);
    warnings.push(...componentValidation.warnings);

    // Validate executor mappings
    const executorValidation = validateExecutorMappings();
    errors.push(...executorValidation.errors);
    warnings.push(...executorValidation.warnings);

    // Validate consistency between systems
    const consistencyValidation = validateSystemConsistency();
    errors.push(...consistencyValidation.errors);
    warnings.push(...consistencyValidation.warnings);

    const isValid = errors.length === 0;
    
    if (isValid) {
      logger.info('✅ Node registration validation passed');
    } else {
      logger.error('❌ Node registration validation failed', { errors, warnings });
    }

    return { isValid, errors, warnings };
    
  } catch (error) {
    const errorMessage = `Validation failed with exception: ${error}`;
    logger.error(errorMessage);
    return {
      isValid: false,
      errors: [errorMessage],
      warnings: []
    };
  }
}

// Validate that all nodes have corresponding components
function validateComponentMappings(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const nodeTypes = Object.keys(NODE_DEFINITIONS);
    const componentMapping = getNodeComponentMapping();
    const componentTypes = Object.keys(componentMapping);

    // Check for missing components
    const missingComponents = nodeTypes.filter(type => !componentTypes.includes(type));
    if (missingComponents.length > 0) {
      errors.push(`Missing components for nodes: ${missingComponents.join(', ')}`);
    }

    // Check for extra components (not necessarily an error, but worth noting)
    const extraComponents = componentTypes.filter(type => !nodeTypes.includes(type));
    if (extraComponents.length > 0) {
      warnings.push(`Extra components found (not in NODE_DEFINITIONS): ${extraComponents.join(', ')}`);
    }

    // Validate component references are not null/undefined
    for (const [nodeType, component] of Object.entries(componentMapping)) {
      if (!component) {
        errors.push(`Component for node type '${nodeType}' is null or undefined`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`Component mapping validation failed: ${error}`],
      warnings: []
    };
  }
}

// Validate that all nodes have corresponding executor handlers
function validateExecutorMappings(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const nodeTypes = Object.keys(NODE_DEFINITIONS);
    const allExecutorNodes = Object.values(EXECUTOR_NODE_MAPPINGS).flat();

    // Check that all nodes are covered by executors
    const uncoveredNodes = nodeTypes.filter(type => !allExecutorNodes.includes(type as any));
    if (uncoveredNodes.length > 0) {
      errors.push(`Nodes not covered by any executor: ${uncoveredNodes.join(', ')}`);
    }

    // Check for duplicate node coverage
    const nodeCounts = new Map<string, number>();
    allExecutorNodes.forEach(nodeType => {
      nodeCounts.set(nodeType, (nodeCounts.get(nodeType) || 0) + 1);
    });

    const duplicateNodes = Array.from(nodeCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([nodeType, count]) => `${nodeType} (${count} executors)`);
    
    if (duplicateNodes.length > 0) {
      warnings.push(`Nodes handled by multiple executors: ${duplicateNodes.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`Executor mapping validation failed: ${error}`],
      warnings: []
    };
  }
}

// Validate consistency between different systems
function validateSystemConsistency(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Validate that executor categories match NODE_DEFINITIONS
    for (const [executorType, nodeTypes] of Object.entries(EXECUTOR_NODE_MAPPINGS)) {
      for (const nodeType of nodeTypes) {
        const nodeDefinition = NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS];
        if (!nodeDefinition) {
          errors.push(`Executor ${executorType} references unknown node type: ${nodeType}`);
          continue;
        }

        // Check that executor type matches node definition
        if (nodeDefinition.execution.executor !== executorType) {
          errors.push(
            `Inconsistent executor mapping: ${nodeType} is mapped to executor '${executorType}' ` +
            `but NODE_DEFINITIONS specifies '${nodeDefinition.execution.executor}'`
          );
        }
      }
    }

    // Validate dynamic port metadata
    for (const [nodeType, definition] of Object.entries(NODE_DEFINITIONS)) {
      if ((definition as any).metadata?.supportsDynamicPorts) {
        if (!(definition as any).metadata.portGenerator) {
          warnings.push(`Node ${nodeType} supports dynamic ports but has no portGenerator specified`);
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`System consistency validation failed: ${error}`],
      warnings: []
    };
  }
}

// Validate a specific node type registration
export function validateNodeType(nodeType: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if node exists in definitions
  const definition = NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS];
  if (!definition) {
    errors.push(`Node type '${nodeType}' not found in NODE_DEFINITIONS`);
    return { isValid: false, errors, warnings };
  }

  // Check component mapping
  try {
    const componentMapping = getNodeComponentMapping();
    if (!componentMapping[nodeType]) {
      errors.push(`No component mapping found for node type '${nodeType}'`);
    }
  } catch (error) {
    errors.push(`Failed to validate component for '${nodeType}': ${error}`);
  }

  // Check executor mapping
  const executorType = definition.execution.executor;
  const executorNodes = EXECUTOR_NODE_MAPPINGS[executorType as keyof typeof EXECUTOR_NODE_MAPPINGS];
  if (!executorNodes || !executorNodes.includes(nodeType as any)) {
    errors.push(`Node type '${nodeType}' not found in executor '${executorType}' mappings`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// Development helper: validate on startup in development
export function validateOnStartup(): void {
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔍 Running node registration validation...');
    const result = validateNodeRegistration();
    
    if (!result.isValid) {
      logger.error('❌ Node registration validation failed on startup');
      result.errors.forEach(error => logger.error(`  • ${error}`));
      result.warnings.forEach(warning => logger.warn(`  ⚠ ${warning}`));
      
      // In development, we could throw to prevent startup with invalid configuration
      // throw new Error('Node registration validation failed');
    } else {
      logger.info('✅ Node registration validation passed');
      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => logger.warn(`  ⚠ ${warning}`));
      }
    }
  }
}
