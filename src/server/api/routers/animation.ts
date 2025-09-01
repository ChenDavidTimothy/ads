// src/server/api/routers/animation.ts - Graceful error handling with comprehensive validation + debug execution
import { z } from "zod";
import type { createTRPCContext } from "@/server/api/trpc";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { logger } from "@/lib/logger";
import {
  isDomainError,
  UserJobLimitError,
  NoValidScenesError,
} from "@/shared/errors/domain";
import {
  DEFAULT_SCENE_CONFIG,
  type SceneAnimationConfig,
} from "@/server/rendering/renderer";
import { ExecutionEngine } from "@/server/animation-processing/execution-engine";
import {
  getNodeDefinition,
  getNodesByCategory,
} from "@/shared/registry/registry-utils";
import { buildZodSchemaFromProperties } from "@/shared/types/properties";
import { arePortsCompatible } from "@/shared/types/ports";
import type { AnimationScene, NodeData, SceneNodeData } from "@/shared/types";
import type { ReactFlowNode } from "@/server/animation-processing/execution-engine";
import { renderQueue, ensureWorkerReady } from "@/server/jobs/render-queue";
import { waitForRenderJobEvent } from "@/server/jobs/pg-events";
import { createServiceClient } from "@/utils/supabase/service";
import {
  partitionObjectsByScenes,
  buildAnimationSceneFromPartition,
  partitionByBatchKey,
} from "@/server/animation-processing/scene/scene-partitioner";
import type {
  ScenePartition,
  BatchedScenePartition,
} from "@/server/animation-processing/scene/scene-partitioner";
import type { SceneObject, SceneAnimationTrack } from "@/shared/types/scene";
import {
  buildContentBasename,
  sanitizeForFilename,
} from "@/shared/utils/naming";

// Helper: namespace object and animation IDs deterministically for batch key
function namespaceObjectsForBatch(
  objects: SceneObject[],
  batchKey: string | null,
): SceneObject[] {
  if (!batchKey) return objects;
  const suffix = `@${batchKey}`;
  return objects.map((o) => ({ ...o, id: `${o.id}${suffix}` }));
}

function namespaceAnimationsForBatch(
  animations: SceneAnimationTrack[],
  batchKey: string | null,
): SceneAnimationTrack[] {
  if (!batchKey) return animations;
  const suffix = `@${batchKey}`;
  return animations.map((a) => ({
    ...a,
    id: `${a.id}${suffix}`,
    objectId: `${a.objectId}${suffix}`,
  }));
}

// Helper: namespace batch overrides to match namespaced object IDs
function namespaceBatchOverridesForBatch(
  batchOverrides:
    | Record<string, Record<string, Record<string, unknown>>>
    | undefined,
  batchKey: string | null,
): Record<string, Record<string, Record<string, unknown>>> | undefined {
  if (!batchKey || !batchOverrides) return batchOverrides;
  const suffix = `@${batchKey}`;
  const namespaced: Record<
    string,
    Record<string, Record<string, unknown>>
  > = {};

  for (const [objectId, fieldOverrides] of Object.entries(batchOverrides)) {
    namespaced[`${objectId}${suffix}`] = fieldOverrides;
  }

  return namespaced;
}

// Helper: namespace bound fields map to match namespaced object IDs
function namespaceBoundFieldsForBatch(
  bound: Record<string, string[]> | undefined,
  batchKey: string | null,
): Record<string, string[]> | undefined {
  if (!batchKey || !bound) return bound;
  const suffix = `@${batchKey}`;
  const out: Record<string, string[]> = {};
  for (const [objectId, keys] of Object.entries(bound)) {
    out[`${objectId}${suffix}`] = keys;
  }
  return out;
}

// Helper: create a fully namespaced partition for batch key processing
function namespacePartitionForBatch(
  partition: ScenePartition,
  batchKey: string | null,
): BatchedScenePartition {
  return {
    sceneNode: partition.sceneNode,
    objects: namespaceObjectsForBatch(partition.objects, batchKey),
    animations: namespaceAnimationsForBatch(partition.animations, batchKey),
    batchOverrides: namespaceBatchOverridesForBatch(
      partition.batchOverrides,
      batchKey,
    ),
    boundFieldsByObject: namespaceBoundFieldsForBatch(
      partition.boundFieldsByObject,
      batchKey,
    ),
    batchKey: batchKey,
  };
}

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// Type for backend nodes after processing
type BackendNode = {
  id: string;
  type: string | undefined;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

// Type for backend edges after processing
type BackendEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

// Scene config schema (coerce types where the client might send strings)
const sceneConfigSchema = z.object({
  width: z.coerce.number().max(1920).optional(),
  height: z.coerce.number().max(1080).optional(),
  fps: z.coerce.number().max(60).optional(),
  backgroundColor: z.string().optional(),
  videoPreset: z.string().optional(),
  videoCrf: z.coerce.number().min(0).max(51).optional(),
});

// Registry-aware ReactFlow Node schema
const reactFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.unknown(),
});

// ReactFlow Edge schema
const reactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

const generateSceneInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  config: sceneConfigSchema.optional(),
});

const validateSceneInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
});

// Debug execution schema
const debugExecutionInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  targetNodeId: z.string(), // Stop execution at this node
});

type GenerateSceneInput = z.infer<typeof generateSceneInputSchema>;
type ValidateSceneInput = z.infer<typeof validateSceneInputSchema>;
type DebugExecutionInput = z.infer<typeof debugExecutionInputSchema>;
type ReactFlowNodeInput = z.infer<typeof reactFlowNodeSchema>;
type ReactFlowEdgeInput = z.infer<typeof reactFlowEdgeSchema>;

// Validation result type for graceful error handling
interface ValidationResult {
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

// Define interfaces for type safety
interface Point2DValue {
  x?: number;
  y?: number;
}

interface PropertySchema {
  key: string;
  type: string;
  defaultValue?: unknown;
}

interface NodeDefinition {
  defaults?: Record<string, unknown>;
  properties?: {
    properties?: PropertySchema[];
  };
}

// Type guard functions
function isPoint2DValue(value: unknown): value is Point2DValue {
  return typeof value === "object" && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Type guard for identifier data
function hasIdentifier(data: unknown): data is { identifier: { id: string } } {
  return (
    typeof data === "object" &&
    data !== null &&
    "identifier" in data &&
    typeof (data as { identifier: unknown }).identifier === "object" &&
    (data as { identifier: unknown }).identifier !== null &&
    "id" in (data as { identifier: { id: unknown } }).identifier &&
    typeof (data as { identifier: { id: unknown } }).identifier.id === "string"
  );
}

// Convert BackendNode to ReactFlowNode with proper typing - FIXED: Remove unnecessary type assertion
function convertBackendNodeToReactFlowNode(
  backendNode: BackendNode,
): ReactFlowNode<NodeData> {
  return {
    id: backendNode.id,
    type: backendNode.type,
    position: backendNode.position,
    data: backendNode.data as unknown as NodeData, // This assertion is necessary and safe here
  };
}

// Fixed ID mapping logic - removing unsafe type assertions
function createNodeIdMap(nodes: ReactFlowNodeInput[]): Map<string, string> {
  const nodeIdMap = new Map<string, string>();
  nodes.forEach((n) => {
    if (hasIdentifier(n.data)) {
      nodeIdMap.set(n.id, n.data.identifier.id);
    }
  });
  return nodeIdMap;
}

// Merge node data with registry defaults, ignoring undefined values and fixing point2d shapes
function mergeNodeDataWithDefaults(
  nodeType: string | undefined,
  rawData: unknown,
): Record<string, unknown> {
  const definition: NodeDefinition | undefined = nodeType
    ? getNodeDefinition(nodeType)
    : undefined;
  const defaults = definition?.defaults ?? {};
  const data = isRecord(rawData) ? rawData : {};

  // Look up property schemas up-front so we can handle structured types (e.g., point2d)
  const propertySchemas = definition?.properties?.properties ?? [];
  const point2dKeys = new Set(
    propertySchemas.filter((s) => s.type === "point2d").map((s) => s.key),
  );

  // Start with defaults, then override with provided values except undefined
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    // Deep-merge point2d objects so providing only x (or y) preserves the other axis from defaults
    if (point2dKeys.has(key) && isPoint2DValue(value)) {
      const baseObj = isRecord(defaults[key]) ? defaults[key] : {};
      merged[key] = { ...baseObj, ...value };
    } else {
      merged[key] = value;
    }
  }

  // Ensure point2d properties are well-formed (x,y numbers)
  for (const schema of propertySchemas) {
    if (schema.type === "point2d") {
      // Prefer actual input, then node-level defaults, then schema defaults, then 0
      const provided = isPoint2DValue(data[schema.key])
        ? (data[schema.key] as Point2DValue)
        : {};
      const nodeDef = isPoint2DValue(defaults[schema.key])
        ? (defaults[schema.key] as Point2DValue)
        : undefined;
      const schemaDef = isPoint2DValue(schema.defaultValue)
        ? schema.defaultValue
        : undefined;

      // Type-safe coordinate extraction
      const currentMerged = isRecord(merged[schema.key])
        ? (merged[schema.key] as Point2DValue)
        : {};

      const x =
        typeof provided.x === "number"
          ? provided.x
          : typeof currentMerged.x === "number"
            ? currentMerged.x
            : typeof nodeDef?.x === "number"
              ? nodeDef.x
              : typeof schemaDef?.x === "number"
                ? schemaDef.x
                : 0;

      const y =
        typeof provided.y === "number"
          ? provided.y
          : typeof currentMerged.y === "number"
            ? currentMerged.y
            : typeof nodeDef?.y === "number"
              ? nodeDef.y
              : typeof schemaDef?.y === "number"
                ? schemaDef.y
                : 0;

      merged[schema.key] = { x, y } as const;
    }
  }

  return merged;
}

// User-friendly error translation
function translateDomainError(error: unknown): {
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

    case "ERR_TOO_MANY_SCENES":
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

    case "ERR_USER_JOB_LIMIT":
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

export const animationRouter = createTRPCRouter({
  // Debug execution endpoint for "Run to Here" functionality
  debugToNode: protectedProcedure
    .input(debugExecutionInputSchema)
    .mutation(
      async ({
        input,
        ctx,
      }: {
        input: DebugExecutionInput;
        ctx: TRPCContext;
      }) => {
        try {
          // Convert React Flow nodes to backend format with proper ID mapping
          const backendNodes: BackendNode[] = input.nodes.map(
            (n: ReactFlowNodeInput) => {
              const mergedData = mergeNodeDataWithDefaults(n.type, n.data);
              return {
                id: n.id,
                type: n.type,
                position: n.position,
                data: mergedData,
              };
            },
          );

          // Convert React Flow edges to backend format with identifier ID mapping
          const nodeIdMap = createNodeIdMap(input.nodes);

          const backendEdges: BackendEdge[] = input.edges.map(
            (e: ReactFlowEdgeInput) => ({
              id: e.id,
              source: nodeIdMap.get(e.source) ?? e.source,
              target: nodeIdMap.get(e.target) ?? e.target,
              sourceHandle: e.sourceHandle ?? undefined,
              targetHandle: e.targetHandle ?? undefined,
            }),
          );

          // Get target node identifier ID
          const targetReactFlowId = input.targetNodeId;
          const targetIdentifierId =
            nodeIdMap.get(targetReactFlowId) ?? targetReactFlowId;

          // Execute flow with debug stopping point
          const engine = new ExecutionEngine();
          const reactFlowNodes = backendNodes.map(
            convertBackendNodeToReactFlowNode,
          );
          const executionContext = await engine.executeFlowDebug(
            reactFlowNodes,
            backendEdges,
            targetIdentifierId,
          );

          // Extract debug logs from context and format for frontend consumption
          const executionLog = executionContext.executionLog ?? [];
          const debugLogs = executionLog
            .filter((entry) => {
              return (
                entry.data &&
                typeof entry.data === "object" &&
                entry.data !== null &&
                (entry.data as { type?: string }).type === "result_output"
              );
            })
            .map((entry) => {
              const entryData = entry.data as {
                type: string;
                [key: string]: unknown;
              };
              return {
                nodeId: entry.nodeId,
                timestamp: entry.timestamp,
                action: entry.action,
                data: entryData,
              };
            });

          return {
            success: true,
            executedNodeCount: executionContext.executedNodes.size,
            debugLogs,
            stoppedAt: targetIdentifierId,
          };
        } catch (error) {
          // Log server-side error
          logger.domain("Debug execution failed", error, {
            path: "animation.debugToNode",
            userId: ctx.user?.id,
            targetNodeId: input.targetNodeId,
          });

          // Return detailed error information using the same translation as generate video
          const translated = translateDomainError(error);
          return {
            success: false,
            error: translated.message,
            suggestions: translated.suggestions,
            // Add additional context for debugging
            errorType: isDomainError(error)
              ? error.code
              : "ERR_DEBUG_EXECUTION_FAILED",
          };
        }
      },
    ),

  // Main scene generation with comprehensive graceful validation
  generateScene: protectedProcedure
    .input(generateSceneInputSchema)
    .mutation(
      async ({
        input,
        ctx,
      }: {
        input: GenerateSceneInput;
        ctx: TRPCContext;
      }) => {
        try {
          // Convert React Flow nodes to backend format with proper ID mapping
          const backendNodes: BackendNode[] = input.nodes.map(
            (n: ReactFlowNodeInput) => {
              const mergedData = mergeNodeDataWithDefaults(n.type, n.data);
              return {
                id: n.id,
                type: n.type,
                position: n.position,
                data: mergedData,
              };
            },
          );

          // Convert React Flow edges to backend format with identifier ID mapping
          const nodeIdMap = createNodeIdMap(input.nodes);

          const backendEdges: BackendEdge[] = input.edges.map(
            (e: ReactFlowEdgeInput) => ({
              id: e.id,
              source: nodeIdMap.get(e.source) ?? e.source,
              target: nodeIdMap.get(e.target) ?? e.target,
              sourceHandle: e.sourceHandle ?? undefined,
              targetHandle: e.targetHandle ?? undefined,
            }),
          );

          // Registry-aware node validation with graceful error collection
          const nodeValidationResult =
            validateInputNodesGracefully(backendNodes);
          if (!nodeValidationResult.success) {
            return {
              success: false,
              errors: nodeValidationResult.errors,
              canRetry: true,
            };
          }

          // Connection validation with graceful error handling
          const connectionValidationResult = validateConnectionsGracefully(
            input.nodes,
            input.edges,
          );
          if (!connectionValidationResult.success) {
            return {
              success: false,
              errors: connectionValidationResult.errors,
              canRetry: true,
            };
          }

          // Comprehensive flow validation with graceful error handling
          const reactFlowNodesForValidation = backendNodes.map(
            convertBackendNodeToReactFlowNode,
          );
          const flowValidationResult = await validateFlowGracefully(
            reactFlowNodesForValidation,
            backendEdges,
          );
          if (!flowValidationResult.success) {
            return {
              success: false,
              errors: flowValidationResult.errors,
              canRetry: true,
            };
          }

          // If we get here, validation passed - proceed with generation
          const engine = new ExecutionEngine();
          const reactFlowNodesForExecution = backendNodes.map(
            convertBackendNodeToReactFlowNode,
          );
          const executionContext = await engine.executeFlow(
            reactFlowNodesForExecution,
            backendEdges,
          );

          // Find all scene nodes for multi-scene support
          const sceneNodes = reactFlowNodesForExecution.filter(
            (node) => node.type === "scene",
          );
          if (sceneNodes.length === 0) {
            return {
              success: false,
              errors: [
                {
                  type: "error" as const,
                  code: "ERR_SCENE_REQUIRED",
                  message: "Scene node is required",
                  suggestions: ["Add a Scene node from the Output section"],
                },
              ],
              canRetry: true,
            };
          }

          // Check user job limits before processing
          const supabase = createServiceClient();
          const maxUserJobs = Number(process.env.MAX_USER_JOBS ?? "3");

          // First, clean up stale jobs (older than 10 minutes in queued/processing state)
          const staleJobCutoff = new Date(
            Date.now() - 10 * 60 * 1000,
          ).toISOString();
          await supabase
            .from("render_jobs")
            .update({
              status: "failed",
              error: "Job timeout - cleaned up by system",
            })
            .eq("user_id", ctx.user!.id)
            .in("status", ["queued", "processing"])
            .lt("updated_at", staleJobCutoff);

          // Now check current active jobs
          const { data: userActiveJobs, error: jobQueryError } = await supabase
            .from("render_jobs")
            .select("id, status, updated_at")
            .eq("user_id", ctx.user!.id)
            .in("status", ["queued", "processing"]);

          if (jobQueryError) {
            logger.error("Failed to query user jobs", {
              error: jobQueryError,
              userId: ctx.user!.id,
            });
            // Continue without job limit check rather than blocking the user
          } else if (userActiveJobs && userActiveJobs.length >= maxUserJobs) {
            logger.info("User job limit reached", {
              userId: ctx.user!.id,
              activeJobs: userActiveJobs.length,
              maxJobs: maxUserJobs,
              jobs: userActiveJobs,
            });
            throw new UserJobLimitError(userActiveJobs.length, maxUserJobs);
          }

          // Partition objects by scenes
          const scenePartitions = partitionObjectsByScenes(
            executionContext,
            sceneNodes,
            backendEdges,
          );

          if (scenePartitions.length === 0) {
            throw new NoValidScenesError();
          }

          // Create render jobs for each valid scene, partitioning by batchKey
          const jobIds: string[] = [];
          const jobsOut: Array<{
            jobId: string;
            nodeId: string;
            nodeName: string;
            nodeType: "scene";
            batchKey: string | null;
          }> = [];
          await ensureWorkerReady();

          for (const partition of scenePartitions) {
            const subPartitions = partitionByBatchKey(partition);

            logger.debug("Processing subPartitions", {
              sceneId: partition.sceneNode?.data?.identifier?.id,
              subPartitionsCount: subPartitions.length,
              subPartitionsValid: subPartitions.filter((sub) => sub?.sceneNode)
                .length,
              subPartitionsInvalid: subPartitions.filter(
                (sub) => !sub?.sceneNode,
              ).length,
            });

            // Deterministic filename and collision detection per scene
            const filenameMap = new Map<string, string[]>(); // filename -> original keys
            for (const sp of subPartitions) {
              const base = sp.batchKey ? sanitizeForFilename(sp.batchKey) : "";
              const name = `${base || "scene"}.mp4`;
              const list = filenameMap.get(name) ?? [];
              list.push(sp.batchKey ?? "<single>");
              filenameMap.set(name, list);
            }
            const collisions = Array.from(filenameMap.entries()).filter(
              ([, keys]) => keys.length > 1,
            );
            if (collisions.length > 0) {
              const detail = collisions
                .map(([fn, keys]) => `${fn} <= [${keys.join(", ")} ]`)
                .join("; ");
              throw new Error(
                `Filename collision after sanitization: ${detail}. Please choose distinct batch keys.`,
              );
            }
            for (const sub of subPartitions) {
              // Defensive check for undefined sub
              if (!sub?.sceneNode) {
                logger.error("Invalid subPartition detected", {
                  sub: sub,
                  hasSceneNode: sub?.sceneNode ? true : false,
                  partitionIndex: subPartitions.indexOf(sub),
                  totalPartitions: subPartitions.length,
                });
                continue; // Skip invalid partitions
              }

              // Create a properly namespaced sub-partition for the batch key
              const namespacedSubPartition = namespacePartitionForBatch(
                sub,
                sub.batchKey,
              );

              const scene: AnimationScene = buildAnimationSceneFromPartition(
                namespacedSubPartition,
              );
              const sceneData = sub.sceneNode.data as SceneNodeData;
              const displayName = sub.sceneNode.data.identifier.displayName;

              // Prepare scene config using registry defaults
              const config: SceneAnimationConfig = {
                ...DEFAULT_SCENE_CONFIG,
                width: sceneData.width,
                height: sceneData.height,
                fps: sceneData.fps,
                backgroundColor: sceneData.backgroundColor,
                videoPreset: sceneData.videoPreset,
                videoCrf: sceneData.videoCrf,
                ...input.config,
                // Use standardized naming: <displayName>-<batchKey?>
                outputBasename: buildContentBasename(
                  displayName,
                  sub.batchKey ?? undefined,
                ),
                // Group by node id
                outputSubdir: sub.sceneNode.data.identifier.id,
              };

              // Enforce frame cap per scene
              if (config.fps * scene.duration > 1800) {
                logger.warn(
                  `Scene ${sub.sceneNode.data.identifier.displayName} exceeds frame limit`,
                  {
                    frames: config.fps * scene.duration,
                    duration: scene.duration,
                    fps: config.fps,
                  },
                );
                continue; // Skip this scene but continue with others
              }

              // Create job row for this scene
              const payload = { scene, config } as const;
              const { data: jobRow, error: insErr } = await supabase
                .from("render_jobs")
                .insert({ user_id: ctx.user!.id, status: "queued", payload })
                .select("id")
                .single();

              if (insErr || !jobRow) {
                logger.error("Failed to create job row for scene", {
                  sceneId: sub.sceneNode.data.identifier.id,
                  error: insErr,
                });
                continue; // Skip this scene but continue with others
              }

              // Compute unique basename with job short id (first 8 hex chars, no dashes)
              const jobShort = String(jobRow.id).replace(/-/g, "").slice(0, 8);
              const uniqueBasename = `${config.outputBasename}-${jobShort}`;
              const uniqueConfig: SceneAnimationConfig = {
                ...config,
                outputBasename: uniqueBasename,
              };

              // Update the job payload to persist subdir for traceability
              await supabase
                .from("render_jobs")
                .update({ payload: { scene, config: uniqueConfig } })
                .eq("id", jobRow.id)
                .eq("user_id", ctx.user!.id);

              // Enqueue the render job
              await renderQueue.enqueueOnly({
                scene,
                config: uniqueConfig,
                userId: ctx.user!.id,
                jobId: jobRow.id as string,
              });

              jobIds.push(jobRow.id as string);
              jobsOut.push({
                jobId: jobRow.id as string,
                nodeId: sub.sceneNode.data.identifier.id,
                nodeName: sub.sceneNode.data.identifier.displayName,
                nodeType: "scene" as const,
                batchKey: sub.batchKey ?? null,
              });
            }
          }

          if (jobIds.length === 0) {
            return {
              success: false,
              errors: [
                {
                  type: "error" as const,
                  code: "ERR_NO_VALID_SCENES",
                  message: "No scenes could be processed",
                  suggestions: [
                    "Check that scenes have valid objects",
                    "Ensure scene durations are within limits",
                    "Verify scene configurations",
                  ],
                },
              ],
              canRetry: true,
            };
          }

          // For single scene, maintain backward compatibility with immediate polling
          if (jobIds.length === 1) {
            const inlineWaitMsRaw =
              process.env.RENDER_JOB_INLINE_WAIT_MS ?? "500";
            const parsed = Number(inlineWaitMsRaw);
            const inlineWaitMs = Number.isFinite(parsed)
              ? Math.min(Math.max(parsed, 0), 5000)
              : 500;
            const notify = await waitForRenderJobEvent({
              jobId: jobIds[0]!,
              timeoutMs: inlineWaitMs,
            });

            if (notify && notify.status === "completed" && notify.publicUrl) {
              const firstPartition = scenePartitions[0];
              if (!firstPartition?.sceneNode?.data?.identifier) {
                logger.error("Invalid scene partition for immediate result", {
                  partitionIndex: 0,
                  hasPartition: !!firstPartition,
                  hasSceneNode: !!firstPartition?.sceneNode,
                  hasIdentifier: !!firstPartition?.sceneNode?.data?.identifier,
                });
                throw new Error(
                  "Invalid scene partition structure for immediate result",
                );
              }

              return {
                success: true,
                immediateResult: {
                  jobId: jobIds[0]!,
                  contentUrl: notify.publicUrl,
                  nodeId: firstPartition.sceneNode.data.identifier.id,
                  nodeName:
                    firstPartition.sceneNode.data.identifier.displayName,
                  nodeType: "scene" as const,
                },
              } as const;
            }
          }

          return {
            success: true,
            jobs: jobsOut,
            totalNodes: jobsOut.length,
            generationType: "batch" as const,
          } as const;
        } catch (error) {
          // Log server-side error
          logger.domain("Scene generation failed", error, {
            path: "animation.generateScene",
            userId: ctx.user?.id,
          });

          // Graceful error response
          const translated = translateDomainError(error);
          return {
            success: false,
            errors: [
              {
                type: "error" as const,
                code: isDomainError(error) ? error.code : "ERR_UNKNOWN",
                message: translated.message,
                suggestions: translated.suggestions,
              },
            ],
            canRetry: true,
          };
        }
      },
    ),

  // Image generation (static) with graceful validation
  generateImage: protectedProcedure
    .input(generateSceneInputSchema)
    .mutation(
      async ({
        input,
        ctx,
      }: {
        input: GenerateSceneInput;
        ctx: TRPCContext;
      }) => {
        try {
          const backendNodes: BackendNode[] = input.nodes.map(
            (n: ReactFlowNodeInput) => {
              const mergedData = mergeNodeDataWithDefaults(n.type, n.data);
              return {
                id: n.id,
                type: n.type,
                position: n.position,
                data: mergedData,
              };
            },
          );
          const nodeIdMap = createNodeIdMap(input.nodes);
          const backendEdges: BackendEdge[] = input.edges.map(
            (e: ReactFlowEdgeInput) => ({
              id: e.id,
              source: nodeIdMap.get(e.source) ?? e.source,
              target: nodeIdMap.get(e.target) ?? e.target,
              sourceHandle: e.sourceHandle ?? undefined,
              targetHandle: e.targetHandle ?? undefined,
            }),
          );

          // Basic node + connection validation as in generateScene
          const nodeValidationResult =
            validateInputNodesGracefully(backendNodes);
          if (!nodeValidationResult.success) {
            return {
              success: false,
              errors: nodeValidationResult.errors,
              canRetry: true,
            };
          }
          const connectionValidationResult = validateConnectionsGracefully(
            input.nodes,
            input.edges,
          );
          if (!connectionValidationResult.success) {
            return {
              success: false,
              errors: connectionValidationResult.errors,
              canRetry: true,
            };
          }

          // Universal validations; do NOT require Scene node or Insert for images
          const engine = new ExecutionEngine();
          const reactFlowNodesForImageValidation = backendNodes.map(
            convertBackendNodeToReactFlowNode,
          );
          engine.runUniversalValidation(
            reactFlowNodesForImageValidation,
            backendEdges,
          );

          const executionContext = await engine.executeFlow(
            reactFlowNodesForImageValidation,
            backendEdges,
            { requireScene: false },
          );

          // Find all frame nodes
          const frameNodes = reactFlowNodesForImageValidation.filter(
            (node) => node.type === "frame",
          );
          if (frameNodes.length === 0) {
            return {
              success: false,
              errors: [
                {
                  type: "error" as const,
                  code: "ERR_FRAME_REQUIRED",
                  message: "Frame node is required",
                  suggestions: ["Add a Frame node from the Output section"],
                },
              ],
              canRetry: true,
            };
          }

          // Partition using scene partitioner (works with frame since we reuse scene executor per-scene storage)
          const scenePartitions = partitionObjectsByScenes(
            executionContext,
            frameNodes,
            backendEdges,
          );
          if (scenePartitions.length === 0) {
            throw new NoValidScenesError();
          }

          // Enqueue image jobs
          const supabase = createServiceClient();
          const jobIds: string[] = [];
          const jobsOut: Array<{
            jobId: string;
            nodeId: string;
            nodeName: string;
            nodeType: "frame";
            batchKey: string | null;
          }> = [];
          await ensureWorkerReady();
          const { imageQueue } = await import("@/server/jobs/image-queue");

          for (const partition of scenePartitions) {
            const subPartitions = partitionByBatchKey(partition);
            for (const sub of subPartitions) {
              if (!sub?.sceneNode) continue;

              const scene: AnimationScene =
                buildAnimationSceneFromPartition(sub);
              const frameData = sub.sceneNode.data as unknown as {
                width: number;
                height: number;
                backgroundColor: string;
                format: "png" | "jpeg";
                quality: number;
              };
              const config = {
                width: Number(frameData.width),
                height: Number(frameData.height),
                backgroundColor: String(frameData.backgroundColor),
                format: frameData.format === "jpeg" ? "jpeg" : "png",
                quality: Number(frameData.quality ?? 90),
                // Standardized naming: <displayName>-<batchKey?>
                outputBasename: buildContentBasename(
                  sub.sceneNode.data.identifier.displayName,
                  sub.batchKey ?? undefined,
                ),
                // Group by node id
                outputSubdir: sub.sceneNode.data.identifier.id,
              } as const;

              const payload = { scene, config } as const;
              const { data: jobRow, error: insErr } = await supabase
                .from("render_jobs")
                .insert({ user_id: ctx.user!.id, status: "queued", payload })
                .select("id")
                .single();
              if (insErr || !jobRow) continue;

              // Compute unique basename for image job
              const jobShortImg = String(jobRow.id)
                .replace(/-/g, "")
                .slice(0, 8);
              const uniqueImgBasename = `${config.outputBasename}-${jobShortImg}`;
              const uniqueImgConfig = {
                ...config,
                outputBasename: uniqueImgBasename,
              } as const;

              // Persist updated payload
              await supabase
                .from("render_jobs")
                .update({ payload: { scene, config: uniqueImgConfig } })
                .eq("id", jobRow.id)
                .eq("user_id", ctx.user!.id);

              await imageQueue.enqueueOnly({
                scene,
                config: { ...uniqueImgConfig },
                userId: ctx.user!.id,
                jobId: jobRow.id as string,
              });

              jobIds.push(jobRow.id as string);
              jobsOut.push({
                jobId: jobRow.id as string,
                nodeId: sub.sceneNode.data.identifier.id,
                nodeName: sub.sceneNode.data.identifier.displayName,
                nodeType: "frame" as const,
                batchKey: sub.batchKey ?? null,
              });
            }
          }

          if (jobIds.length === 0) {
            return {
              success: false,
              errors: [
                {
                  type: "error" as const,
                  code: "ERR_NO_VALID_FRAMES",
                  message: "No frames could be processed",
                },
              ],
              canRetry: true,
            };
          }

          // Optionally short-wait for single job
          if (jobIds.length === 1) {
            const inlineWaitMsRaw =
              process.env.RENDER_JOB_INLINE_WAIT_MS ?? "500";
            const parsed = Number(inlineWaitMsRaw);
            const inlineWaitMs = Number.isFinite(parsed)
              ? Math.min(Math.max(parsed, 0), 5000)
              : 500;
            const notify = await waitForRenderJobEvent({
              jobId: jobIds[0]!,
              timeoutMs: inlineWaitMs,
            });
            if (notify && notify.status === "completed" && notify.publicUrl) {
              const firstPartition = scenePartitions[0];
              if (!firstPartition?.sceneNode?.data?.identifier) {
                logger.error(
                  "Invalid scene partition for frame immediate result",
                  {
                    partitionIndex: 0,
                    hasPartition: !!firstPartition,
                    hasSceneNode: !!firstPartition?.sceneNode,
                    hasIdentifier:
                      !!firstPartition?.sceneNode?.data?.identifier,
                  },
                );
                throw new Error(
                  "Invalid scene partition structure for frame immediate result",
                );
              }

              return {
                success: true,
                immediateResult: {
                  jobId: jobIds[0]!,
                  contentUrl: notify.publicUrl,
                  nodeId: firstPartition.sceneNode.data.identifier.id,
                  nodeName:
                    firstPartition.sceneNode.data.identifier.displayName,
                  nodeType: "frame" as const,
                },
              } as const;
            }
          }

          return {
            success: true,
            jobs: jobsOut,
            totalNodes: jobsOut.length,
            generationType: "batch" as const,
          } as const;
        } catch (error) {
          logger.domain("Image generation failed", error, {
            path: "animation.generateImage",
            userId: ctx.user?.id,
          });
          const translated = translateDomainError(error);
          return {
            success: false,
            errors: [
              {
                type: "error" as const,
                code: isDomainError(error) ? error.code : "ERR_UNKNOWN",
                message: translated.message,
                suggestions: translated.suggestions,
              },
            ],
            canRetry: true,
          };
        }
      },
    ),

  // Enhanced validation endpoint with graceful error reporting
  validateScene: protectedProcedure
    .input(validateSceneInputSchema)
    .query(async ({ input }: { input: ValidateSceneInput }) => {
      const backendNodes: BackendNode[] = input.nodes.map(
        (n: ReactFlowNodeInput) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: mergeNodeDataWithDefaults(n.type, n.data),
        }),
      );

      const nodeIdMap = createNodeIdMap(input.nodes);

      const backendEdges: BackendEdge[] = input.edges.map((e) => ({
        id: e.id,
        source: nodeIdMap.get(e.source) ?? e.source,
        target: nodeIdMap.get(e.target) ?? e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      }));

      const allErrors: ValidationResult["errors"] = [];

      // Node validation
      const nodeValidation = validateInputNodesGracefully(backendNodes);
      allErrors.push(...nodeValidation.errors);

      // Connection validation
      const connectionValidation = validateConnectionsGracefully(
        input.nodes,
        input.edges,
      );
      allErrors.push(...connectionValidation.errors);

      // Flow validation
      try {
        const reactFlowNodesForFlowValidation = backendNodes.map(
          convertBackendNodeToReactFlowNode,
        );
        const flowValidation = await validateFlowGracefully(
          reactFlowNodesForFlowValidation,
          backendEdges,
        );
        allErrors.push(...flowValidation.errors);
      } catch (error) {
        const translated = translateDomainError(error);
        allErrors.push({
          type: "error",
          code: isDomainError(error) ? error.code : "ERR_VALIDATION_FAILED",
          message: translated.message,
          suggestions: translated.suggestions,
        });
      }

      return {
        valid: allErrors.filter((e) => e.type === "error").length === 0,
        errors: allErrors,
      };
    }),

  // Registry information endpoints (unchanged)
  getNodeDefinitions: publicProcedure.query(() => {
    const geometryNodes = getNodesByCategory("geometry");
    const timingNodes = getNodesByCategory("timing");
    const logicNodes = getNodesByCategory("logic");
    const animationNodes = getNodesByCategory("animation");
    const outputNodes = getNodesByCategory("output");

    return {
      geometry: geometryNodes,
      timing: timingNodes,
      logic: logicNodes,
      animation: animationNodes,
      output: outputNodes,
    };
  }),

  getRenderJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(
      async ({
        input,
        ctx,
      }: {
        input: { jobId: string };
        ctx: TRPCContext;
      }) => {
        const supabase = createServiceClient();
        const { data, error } = await supabase
          .from("render_jobs")
          .select("status, output_url, error")
          .eq("id", input.jobId)
          .eq("user_id", ctx.user!.id)
          .single();
        if (error) {
          throw new Error(error.message);
        }

        // If not completed yet, wait briefly for a NOTIFY; then re-check DB before returning
        let current = data;
        if (current?.status !== "completed" || !current?.output_url) {
          const notify = await waitForRenderJobEvent({
            jobId: input.jobId,
            timeoutMs: 25000,
          });
          if (notify && notify.status === "completed" && notify.publicUrl) {
            return {
              status: "completed",
              videoUrl: notify.publicUrl,
              error: null,
            } as const;
          }
          // Fallback: job may have completed during the wait but event was missed; re-query DB
          const { data: latest, error: latestError } = await supabase
            .from("render_jobs")
            .select("status, output_url, error")
            .eq("id", input.jobId)
            .eq("user_id", ctx.user!.id)
            .single();
          if (!latestError && latest) {
            current = latest;
          }
        }

        return {
          status: (current?.status as string) ?? "unknown",
          videoUrl: (current?.output_url as string) ?? null,
          error: (current?.error as string) ?? null,
        } as const;
      },
    ),

  getNodeDefinition: publicProcedure
    .input(z.object({ nodeType: z.string() }))
    .query(({ input }: { input: { nodeType: string } }) => {
      const definition = getNodeDefinition(input.nodeType);
      if (!definition) {
        throw new Error(`Unknown node type: ${input.nodeType}`);
      }
      return definition;
    }),

  getDefaultSceneConfig: publicProcedure.query(() => {
    return DEFAULT_SCENE_CONFIG;
  }),
});

// Graceful validation helper functions
function validateInputNodesGracefully(
  nodes: Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: unknown;
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
        .map((i) => `${i.path.join(".")}: ${i.message}`)
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
    success: errors.filter((e) => e.type === "error").length === 0,
    errors,
  };
}

function validateConnectionsGracefully(
  nodes: ReactFlowNodeInput[],
  edges: ReactFlowEdgeInput[],
): ValidationResult {
  const errors: ValidationResult["errors"] = [];

  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);

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

    if ((edge as { kind?: "data" | "control" }).kind === "control") continue;

    const sourcePort = sourceDef.ports.outputs.find(
      (p) => p.id === edge.sourceHandle,
    );
    const targetPort = targetDef.ports.inputs.find(
      (p) => p.id === edge.targetHandle,
    );

    if (
      sourcePort &&
      targetPort &&
      !arePortsCompatible(sourcePort.type, targetPort.type)
    ) {
      errors.push({
        type: "error",
        code: "ERR_INVALID_CONNECTION",
        message: `Port types incompatible: ${sourcePort.type} → ${targetPort.type}`,
        suggestions: [
          "Connect compatible port types",
          "Check the node documentation for port compatibility",
        ],
      });
    }
  }

  return {
    success: errors.filter((e) => e.type === "error").length === 0,
    errors,
  };
}

async function validateFlowGracefully(
  nodes: ReactFlowNode<NodeData>[],
  edges: BackendEdge[],
): Promise<ValidationResult> {
  const errors: ValidationResult["errors"] = [];

  try {
    const engine = new ExecutionEngine();
    // Use universal validation only - don't require Scene node for general validation
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
    success: errors.filter((e) => e.type === "error").length === 0,
    errors,
  };
}
