import { z } from "zod";

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const sceneConfigSchema = z.object({
  width: z.coerce.number().max(1920).optional(),
  height: z.coerce.number().max(1080).optional(),
  fps: z.coerce.number().max(60).optional(),
  backgroundColor: z.string().optional(),
  videoPreset: z.string().optional(),
  videoCrf: z.coerce.number().min(0).max(51).optional(),
});

export const reactFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: pointSchema,
  data: z.unknown(),
});

export const reactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export const generateSceneInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  config: sceneConfigSchema.optional(),
});

export const validateSceneInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
});

export const debugExecutionInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  targetNodeId: z.string(),
});

export type GenerateSceneInput = z.infer<typeof generateSceneInputSchema>;
export type ValidateSceneInput = z.infer<typeof validateSceneInputSchema>;
export type DebugExecutionInput = z.infer<typeof debugExecutionInputSchema>;
export type ReactFlowNodeInput = z.infer<typeof reactFlowNodeSchema>;
export type ReactFlowEdgeInput = z.infer<typeof reactFlowEdgeSchema>;
