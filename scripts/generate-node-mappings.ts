#!/usr/bin/env tsx
// scripts/generate-node-mappings.ts - Build-time component mapping generation
import { NODE_DEFINITIONS } from '../src/shared/types/definitions';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Convert node type to component name following convention
function getComponentName(nodeType: string): string {
  return (
    nodeType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'Node'
  );
}

// Convert node type to filename (handle underscore to hyphen conversion)
function getComponentFilename(nodeType: string): string {
  return `${nodeType.replace(/_/g, '-')}-node.tsx`;
}

// Validate component files exist
function validateComponentExists(nodeType: string): void {
  const filename = getComponentFilename(nodeType);
  const componentPath = path.join(__dirname, '../src/components/workspace/nodes', filename);
  if (!fs.existsSync(componentPath)) {
    throw new Error(
      `Component file not found: ${componentPath}\nExpected for node type: ${nodeType}`
    );
  }
}

// Generate component mappings
function generateComponentMappings(): string {
  const imports: string[] = [];
  const mappings: string[] = [];
  const nodeTypes = Object.keys(NODE_DEFINITIONS);

  console.log(`Generating mappings for ${nodeTypes.length} node types...`);

  nodeTypes.forEach((nodeType) => {
    const componentName = getComponentName(nodeType);

    // Validate component exists before generating import
    try {
      validateComponentExists(nodeType);
      console.log(`✓ Found component for ${nodeType}: ${componentName}`);
    } catch (error) {
      console.error(`✗ Missing component for ${nodeType}: ${componentName}`);
      throw error;
    }

    const filename = nodeType.replace(/_/g, '-');
    imports.push(`import { ${componentName} } from './${filename}-node';`);
    mappings.push(`  '${nodeType}': ${componentName},`);
  });

  return `// AUTO-GENERATED - Do not edit manually
// Generated from NODE_DEFINITIONS at build time
// To regenerate: npm run generate

${imports.join('\n')}

export const COMPONENT_MAPPING = {
${mappings.join('\n')}
} as const;

export type ComponentMapping = typeof COMPONENT_MAPPING;
export type ValidNodeType = keyof ComponentMapping;

// Runtime validation helper
export function validateNodeType(nodeType: string): nodeType is ValidNodeType {
  return nodeType in COMPONENT_MAPPING;
}
`;
}

// Generate executor method mappings
function generateExecutorMappings(): string {
  const executorMappings: Record<string, string[]> = {};

  Object.entries(NODE_DEFINITIONS).forEach(([nodeType, definition]) => {
    const executor = definition.execution.executor;
    executorMappings[executor] ??= [];
    executorMappings[executor].push(nodeType);
  });

  const mappingEntries = Object.entries(executorMappings)
    .map(([executor, nodeTypes]) => {
      const nodeList = nodeTypes.map((type) => `'${type}'`).join(', ');
      return `  ${executor}: [${nodeList}],`;
    })
    .join('\n');

  return `// AUTO-GENERATED - Executor to node type mappings
export const EXECUTOR_NODE_MAPPINGS = {
${mappingEntries}
} as const;

export type ExecutorType = keyof typeof EXECUTOR_NODE_MAPPINGS;
`;
}

// Main generation function
async function generateMappings(): Promise<void> {
  try {
    const outputDir = path.join(__dirname, '../src/components/workspace/nodes');
    const componentMappingPath = path.join(outputDir, 'generated-mappings.ts');
    const executorMappingPath = path.join(
      __dirname,
      '../src/server/animation-processing/executors/generated-mappings.ts'
    );

    // Ensure output directories exist
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(path.dirname(executorMappingPath), { recursive: true });

    // Generate component mappings
    console.log('Generating component mappings...');
    const componentMappings = generateComponentMappings();
    fs.writeFileSync(componentMappingPath, componentMappings);
    console.log(`✓ Generated: ${componentMappingPath}`);

    // Generate executor mappings
    console.log('Generating executor mappings...');
    const executorMappings = generateExecutorMappings();
    fs.writeFileSync(executorMappingPath, executorMappings);
    console.log(`✓ Generated: ${executorMappingPath}`);

    console.log('✅ All mappings generated successfully!');
  } catch (error) {
    console.error('❌ Failed to generate mappings:', error);
    process.exit(1);
  }
}

// Check if this is the main module
if (process.argv[1] === __filename) {
  void generateMappings();
}

export { generateMappings };
