import { createContext, useContext } from 'react';
import type { VideoJob, ImageJob } from '@/shared/types/jobs';

interface PreviewContext {
  addVideoJob: (job: VideoJob) => void;
  addImageJob: (job: ImageJob) => void;
  updateVideoJob: (jobId: string, updates: Partial<VideoJob>) => void;
  updateImageJob: (jobId: string, updates: Partial<ImageJob>) => void;
}

export const PreviewContext = createContext<PreviewContext | null>(null);

export function usePreviewContext() {
  const context = useContext(PreviewContext);
  if (!context) throw new Error('usePreviewContext must be used within PreviewProvider');
  return context;
}
