// src/shared/registry/validation.ts - Enhanced with cross-worker caching

import { NODE_DEFINITIONS, type NodeType } from '../types/definitions';
import { getNodeComponentMapping } from './registry-utils';
import { EXECUTOR_NODE_MAPPINGS} from '../../server/animation-processing/executors/generated-mappings';
import { logger } from '@/lib/logger';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Type for component mapping return value
type ComponentMapping = Record<string, unknown>;

// Type guard to check if error is an Error object
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Helper to safely convert unknown to string
function errorToString(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Cross-worker validation cache
interface CrossWorkerValidationCache {
  isValid: boolean;
  timestamp: number;
  errors: string[];
  warnings: string[];
  generatedMappingsHash: string;
  pid: number; // Track which process created the cache for debugging
}

const VALIDATION_CACHE_FILE = join(process.cwd(), '.next/validation-cache.json');
const REGISTRY_VALIDATION_TTL = 5 * 60 * 1000; // 5 minutes

// Generate hash from generated mappings to detect code changes
function getGeneratedMappingsHash(): string {
  try {
    const componentMapping = JSON.stringify(getNodeComponentMapping());
    const executorMapping = JSON.stringify(EXECUTOR_NODE_MAPPINGS);
    const nodeDefinitions = JSON.stringify(NODE_DEFINITIONS);
    
    const combined = componentMapping + executorMapping + nodeDefinitions;
    return Buffer.from(combined).toString('base64').slice(0, 16);
  } catch (error) {
    // If we can't generate hash, force fresh validation
    logger.warn('Failed to generate mappings hash, forcing fresh validation', error);
    return `error-${Date.now()}`;
  }
}

// Cross-worker validation with file-based caching
export async function ensureValidationOnce(): Promise<ValidationResult | null> {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const currentHash = getGeneratedMappingsHash();
  const now = Date.now();
  
  // Try to read existing cache
  if (existsSync(VALIDATION_CACHE_FILE)) {
    try {
      const cached: CrossWorkerValidationCache = JSON.parse(
        readFileSync(VALIDATION_CACHE_FILE, 'utf8')
      );
      const age = now - cached.timestamp;
      
      // Check if cache is still valid
      if (age < REGISTRY_VALIDATION_TTL) {
        if (cached.generatedMappingsHash === currentHash) {
          logger.debug(`⚡ Using cached validation result (${Math.round(age/1000)}s old, PID:${cached.pid})`);
          return { 
            isValid: cached.isValid, 
            errors: cached.errors, 
            warnings: cached.warnings 
          };
        } else {
          logger.debug('🔄 Validation cache invalidated due to mapping changes');
        }
      } else {
        logger.debug(`🕐 Validation cache expired (${Math.round(age/1000)}s old, TTL: ${REGISTRY_VALIDATION_TTL/1000}s)`);
      }
    } catch (error) {
      logger.debug('📁 Validation cache file corrupted, running fresh validation', error);
    }
  } else {
    logger.debug('📝 No validation cache found, running initial validation');
  }
  
  // Run fresh validation
  logger.debug(`🔍 Running fresh node registration validation (PID:${process.pid})`);
  const result = validateNodeRegistration();
  
  // Save to file cache for other workers
  const cacheData: CrossWorkerValidationCache = {
    isValid: result.isValid,
    timestamp: now,
    errors: result.errors,
    warnings: result.warnings,
    generatedMappingsHash: currentHash,
    pid: process.pid
  };
  
  try {
    // Ensure .next directory exists
    const cacheDir = dirname(VALIDATION_CACHE_FILE);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    
    writeFileSync(VALIDATION_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
    logger.debug(`💾 Saved validation cache for other workers`);
  } catch (error) {
    // File write failed, but validation still succeeded
    logger.warn('Failed to write validation cache file', error);
  }
  
  return result;
}

// Legacy per-process cache (kept for compatibility but not used in new flow)
interface RegistryValidationCache {
  isValid: boolean;
  timestamp: number;
  result: ValidationResult;
}

let registryValidationCache: RegistryValidationCache | null = null;

// Legacy function - deprecated in favor of ensureValidationOnce
export function validateOnStartup(): ValidationResult | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const now = Date.now();
  
  // Return cached result if recently validated
  if (registryValidationCache && (now - registryValidationCache.timestamp) < REGISTRY_VALIDATION_TTL) {
    logger.debug('⚡ Skipping node registration validation - recently validated');
    return registryValidationCache.result;
  }

  const processInfo = `PID:${process.pid}`;
  logger.debug(`🔍 Running node registration validation... (${processInfo})`);
  const result = validateNodeRegistration();
  
  // Cache the result with timestamp
  registryValidationCache = {
    isValid: result.isValid,
    timestamp: now,
    result
  };

  if (!result.isValid) {
    logger.error('❌ Node registration validation failed on startup');
    result.errors.forEach(error => logger.error(`  • ${error}`));
    result.warnings.forEach(warning => logger.warn(`  ⚠ ${warning}`));
    
    // In development, we could throw to prevent startup with invalid configuration
    // throw new Error('Node registration validation failed');
  } else {
    // Success message already logged by validateNodeRegistration()
    // Only log additional warnings if present
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => logger.warn(`  ⚠ ${warning}`));
    }
  }

  return result;
}

// Force re-validation (useful for testing or when node definitions change)
export function resetValidationCache(): void {
  registryValidationCache = null;
  
  // Also remove file cache in development
  if (process.env.NODE_ENV === 'development' && existsSync(VALIDATION_CACHE_FILE)) {
    try {
      require('fs').unlinkSync(VALIDATION_CACHE_FILE);
      logger.debug('🗑️ Cleared validation cache file');
    } catch (error) {
      logger.warn('Failed to remove validation cache file', error);
    }
  }
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
    const errorMessage = `Validation failed with exception: ${errorToString(error)}`;
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
    const nodeTypes = Object.keys(NODE_DEFINITIONS) as NodeType[];
    const componentMapping = getNodeComponentMapping() as ComponentMapping;
    const componentTypes = Object.keys(componentMapping);

    // Check for missing components
    const missingComponents = nodeTypes.filter(type => !componentTypes.includes(type));
    if (missingComponents.length > 0) {
      errors.push(`Missing components for nodes: ${missingComponents.join(', ')}`);
    }

    // Check for extra components (not necessarily an error, but worth noting)
    const extraComponents = componentTypes.filter(type => !nodeTypes.includes(type as NodeType));
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
      errors: [`Component mapping validation failed: ${errorToString(error)}`],
      warnings: []
    };
  }
}

// Validate that all nodes have corresponding executor handlers
function validateExecutorMappings(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const nodeTypes = Object.keys(NODE_DEFINITIONS) as NodeType[];
    const allExecutorNodes = Object.values(EXECUTOR_NODE_MAPPINGS).flat();

    // Check that all nodes are covered by executors
    const uncoveredNodes = nodeTypes.filter(type => !allExecutorNodes.includes(type));
    if (uncoveredNodes.length > 0) {
      errors.push(`Nodes not covered by any executor: ${uncoveredNodes.join(', ')}`);
    }

    // Check for duplicate node coverage
    const nodeCounts = new Map<string, number>();
    allExecutorNodes.forEach(nodeType => {
      nodeCounts.set(nodeType, (nodeCounts.get(nodeType) ?? 0) + 1);
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
      errors: [`Executor mapping validation failed: ${errorToString(error)}`],
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
        const nodeDefinition = NODE_DEFINITIONS[nodeType];
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
    for (const nodeType of Object.keys(NODE_DEFINITIONS) as NodeType[]) {
      const definition = NODE_DEFINITIONS[nodeType];
      // Use type assertion to access metadata safely since we know some nodes have it
      const metadata = (definition as { metadata?: { supportsDynamicPorts?: boolean; portGenerator?: string } }).metadata;
      if (metadata?.supportsDynamicPorts) {
        if (!metadata.portGenerator) {
          warnings.push(`Node ${nodeType} supports dynamic ports but has no portGenerator specified`);
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`System consistency validation failed: ${errorToString(error)}`],
      warnings: []
    };
  }
}

// Validate a specific node type registration
export function validateNodeType(nodeType: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if node exists in definitions
  const definition = NODE_DEFINITIONS[nodeType as NodeType];
  if (!definition) {
    errors.push(`Node type '${nodeType}' not found in NODE_DEFINITIONS`);
    return { isValid: false, errors, warnings };
  }

  // Check component mapping
  try {
    const componentMapping = getNodeComponentMapping() as ComponentMapping;
    if (!componentMapping[nodeType]) {
      errors.push(`No component mapping found for node type '${nodeType}'`);
    }
  } catch (error) {
    errors.push(`Failed to validate component for '${nodeType}': ${errorToString(error)}`);
  }

  // Check executor mapping
  const executorType = definition.execution.executor;
  if (executorType in EXECUTOR_NODE_MAPPINGS) {
    const executorNodes = EXECUTOR_NODE_MAPPINGS[executorType];
    if (!executorNodes.includes(nodeType as never)) {
      errors.push(`Node type '${nodeType}' not found in executor '${executorType}' mappings`);
    }
  } else {
    errors.push(`Unknown executor type '${executorType}' for node '${executorType}'`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}