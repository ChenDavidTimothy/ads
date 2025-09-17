// src/server/jobs/image-queue.ts
import type { AnimationScene } from '@/shared/types/scene';
import { GraphileQueue } from './graphile-queue';

export interface ImageJobInput {
  scene: AnimationScene;
  config: {
    width: number;
    height: number;
    backgroundColor: string;
    format: 'png' | 'jpeg';
    quality?: number;
    time?: number;
  };
  userId: string;
  jobId: string;
}

export interface ImageJobResult {
  publicUrl: string;
}

export const imageQueue = new GraphileQueue<ImageJobInput, ImageJobResult>({
  taskIdentifier: 'render-image',
});
