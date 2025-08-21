// src/server/animation-processing/types/graph.ts
import type { NodeData } from "@/shared/types";

export interface ReactFlowNode<T = NodeData> {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: T;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  kind?: "data" | "control";
}
