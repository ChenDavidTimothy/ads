import { ExecutionEngine } from "@/server/animation-processing/execution-engine";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import { isDomainError } from "@/shared/errors/domain";
import { buildZodSchemaFromProperties } from "@/shared/types/properties";
import { arePortsCompatible } from "@/shared/types/ports";
import type { NodeData } from "@/shared/types";
import type { ReactFlowNode } from "@/server/animation-processing/execution-engine";
import type { BackendEdge } from "../flow-transformers";

export interface ValidationResult {
  success: boolean;
  errors: Array<{
    type: "error" | "warning";
    code: string;
    message: string;
    suggestions?: string[];
    nodeId?: string;
    nodeName?: string;
  }>;
}

export interface ReactFlowNodeLike {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: unknown;
}

export interface ReactFlowEdgeLike {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  kind?: "data" | "control";
}

export function translateDomainError(error: unknown): {
  message: string;
  suggestions: string[];
} {
  if (!isDomainError(error)) {
    return {
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
      suggestions: ["Please check your node configuration and try again"],
    };
  }

  switch (error.code) {
    case "ERR_SCENE_REQUIRED":
      return {
        message: "A Scene node is required to generate video",
        suggestions: [
          "Add a Scene node from the Output section in the node palette",
          "Connect your animation workspace to the Scene node",
        ],
      };

    case "ERR_TOO_MANY_SCENES": {
      const sceneCount = error.details?.info?.sceneCount as number | undefined;
      const maxAllowed = error.details?.info?.maxAllowed as number | undefined;
      return {
        message: maxAllowed
          ? `Maximum ${maxAllowed} scenes per execution (found ${sceneCount ?? "multiple"})`
          : "Too many Scene nodes in workspace",
        suggestions: [
          "Reduce the number of Scene nodes",
          "Split complex workspaces into separate executions",
          "Consider using fewer scenes for better performance",
        ],
      };
    }

    case "ERR_INVALID_CONNECTION":
      return {
        message: error.message || "Invalid connection detected",
        suggestions: [
          "Check that port types are compatible",
          "Verify merge nodes have unique connections per input port",
          "Ensure all connected nodes exist",
        ],
      };

    case "ERR_MISSING_INSERT_CONNECTION":
      return {
        message: error.message || "Geometry objects need timing information",
        suggestions: [
          "Connect geometry nodes through Insert nodes to control when they appear",
          "Insert nodes specify when objects become visible in the timeline",
        ],
      };

    case "ERR_MULTIPLE_INSERT_NODES_IN_SERIES":
      return {
        message:
          error.message || "Multiple Insert nodes detected in the same path",
        suggestions: [
          "Objects can only have one appearance time",
          "Use separate paths for different timing",
          "Use a Merge node to combine objects with different timing",
        ],
      };

    case "ERR_DUPLICATE_OBJECT_IDS":
      return {
        message:
          error.message ||
          "Objects reach the same destination through multiple paths",
        suggestions: [
          "Add a Merge node to combine objects before they reach non-merge nodes",
          "Merge nodes resolve conflicts when identical objects arrive from different paths",
          "Check your workspace for branching that reconnects later",
        ],
      };

    case "ERR_NODE_VALIDATION_FAILED":
      return {
        message: "Some nodes have invalid properties",
        suggestions: [
          "Check the Properties panel for validation errors",
          "Verify all required fields are filled",
          "Ensure numeric values are within valid ranges",
        ],
      };

    case "ERR_SCENE_VALIDATION_FAILED":
      return {
        message: "Scene configuration has issues",
        suggestions: [
          "Check animation duration and frame limits",
          "Verify scene properties in the Properties panel",
          "Ensure total frames don't exceed system limits",
        ],
      };

    case "ERR_CIRCULAR_DEPENDENCY":
      return {
        message: "Circular connections detected in your node graph",
        suggestions: [
          "Remove connections that create loops",
          "Ensure data flows in one direction from geometry to scene",
          "Check for accidentally connected output back to input",
        ],
      };

    case "ERR_USER_JOB_LIMIT": {
      const currentJobs = error.details?.info?.currentJobs as
        | number
        | undefined;
      const maxJobs = error.details?.info?.maxJobs as number | undefined;
      return {
        message: maxJobs
          ? `Maximum ${maxJobs} concurrent render jobs per user${currentJobs ? ` (currently: ${currentJobs})` : ""}`
          : "Too many concurrent render jobs",
        suggestions: [
          "Wait for current jobs to complete before starting new ones",
          "Check your job status to see which jobs are still running",
          "Consider reducing the complexity of your animations",
        ],
      };
    }

    case "ERR_NO_VALID_SCENES":
      return {
        message: "No scenes received valid data",
        suggestions: [
          "Ensure your geometry objects are connected to Scene nodes",
          "Check that Insert nodes are properly connected",
          "Verify that your flow produces valid objects",
        ],
      };

    case "ERR_MULTIPLE_RESULT_VALUES":
      return {
        message: "Result node received multiple values simultaneously",
        suggestions: [
          "Use If-Else or Boolean logic to ensure only one path executes",
          "Check that conditional branches don't execute simultaneously",
          "Verify logic workspace produces single result",
        ],
      };

    default:
      return {
        message: error.message || "Validation error occurred",
        suggestions: ["Please review your node setup and connections"],
      };
  }
}

export function validateInputNodesGracefully(
  nodes: Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    data?: unknown;
  }>,
): ValidationResult {
  const errors: ValidationResult["errors"] = [];

  for (const node of nodes) {
    if (!node.type) {
      errors.push({
        type: "error",
        code: "ERR_MISSING_NODE_TYPE",
        message: `Node ${node.id} has no type specified`,
        nodeId: node.id,
      });
      continue;
    }

    const definition = getNodeDefinition(node.type);
    if (!definition) {
      errors.push({
        type: "error",
        code: "ERR_UNKNOWN_NODE_TYPE",
        message: `Unknown node type: ${node.type}`,
        nodeId: node.id,
      });
      continue;
    }

    const schema = buildZodSchemaFromProperties(
      definition.properties.properties,
    );
    const result = schema.safeParse(node.data);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      errors.push({
        type: "error",
        code: "ERR_NODE_PROPERTY_VALIDATION",
        message: `Node property validation failed: ${issues}`,
        nodeId: node.id,
        suggestions: [
          "Check the Properties panel for this node",
          "Verify all required fields are filled",
        ],
      });
    }
  }

  return {
    success: errors.filter((error) => error.type === "error").length === 0,
    errors,
  };
}

export function validateConnectionsGracefully(
  nodes: ReactFlowNodeLike[],
  edges: ReactFlowEdgeLike[],
): ValidationResult {
  const errors: ValidationResult["errors"] = [];

  for (const edge of edges) {
    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);

    if (!source || !target) {
      errors.push({
        type: "error",
        code: "ERR_INVALID_CONNECTION",
        message: `Connection references non-existent nodes: ${edge.source} -> ${edge.target}`,
        suggestions: [
          "Remove invalid connections",
          "Ensure all connected nodes exist",
        ],
      });
      continue;
    }

    const sourceDef = getNodeDefinition(source.type ?? "");
    const targetDef = getNodeDefinition(target.type ?? "");

    if (!sourceDef || !targetDef) {
      errors.push({
        type: "error",
        code: "ERR_INVALID_CONNECTION",
        message: `Unknown node types in connection: ${source.type} -> ${target.type}`,
        suggestions: ["Check node types are valid"],
      });
      continue;
    }

    if (edge.kind === "control") continue;

    const sourcePort = sourceDef.ports.outputs.find(
      (port) => port.id === edge.sourceHandle,
    );
    const targetPort = targetDef.ports.inputs.find(
      (port) => port.id === edge.targetHandle,
    );

    if (
      sourcePort &&
      targetPort &&
      !arePortsCompatible(sourcePort.type, targetPort.type)
    ) {
      errors.push({
        type: "error",
        code: "ERR_INVALID_CONNECTION",
        message: `Port types incompatible: ${sourcePort.type} -> ${targetPort.type}`,
        suggestions: [
          "Connect compatible port types",
          "Check the node documentation for port compatibility",
        ],
      });
    }
  }

  return {
    success: errors.filter((error) => error.type === "error").length === 0,
    errors,
  };
}

export async function validateFlowGracefully(
  nodes: ReactFlowNode<NodeData>[],
  edges: BackendEdge[],
): Promise<ValidationResult> {
  const errors: ValidationResult["errors"] = [];

  try {
    const engine = new ExecutionEngine();
    engine.runUniversalValidation(nodes, edges);
  } catch (error) {
    const translated = translateDomainError(error);
    errors.push({
      type: "error",
      code: isDomainError(error) ? error.code : "ERR_FLOW_VALIDATION_FAILED",
      message: translated.message,
      suggestions: translated.suggestions,
    });
  }

  return {
    success: errors.filter((error) => error.type === "error").length === 0,
    errors,
  };
}
