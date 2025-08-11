// src/components/workspace/flow/types.ts
export interface TimelineModalState {
  isOpen: boolean;
  nodeId: string | null;
}

export interface SceneConfig {
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  videoPreset: string;
  videoCrf: number;
}


