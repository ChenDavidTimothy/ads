// src/components/editor/flow/components/VideoPreview.tsx - Enhanced for multi-video support
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface Props {
  videoUrl: string | null; // Legacy single video
  videos: VideoJob[]; // Multi-video support
  onDownloadVideo?: (jobId: string) => void;
  onDownloadAll?: () => void;
}

export function VideoPreview({ videoUrl, videos, onDownloadVideo, onDownloadAll }: Props) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  
  // Use multi-video if available, fallback to single video
  const hasMultipleVideos = videos.length > 0;
  const completedVideos = videos.filter(v => v.status === 'completed' && v.videoUrl);
  
  // If no videos at all, don't render
  if (!hasMultipleVideos && !videoUrl) return null;
  
  // Single video mode (legacy)
  if (!hasMultipleVideos && videoUrl) {
    return (
      <div className="absolute bottom-4 right-4 w-80">
        <video src={videoUrl} controls autoPlay loop className="w-full rounded-md border border-gray-600">
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }
  
  // Multi-video mode
  const activeVideo = completedVideos[activeVideoIndex];
  const processingVideos = videos.filter(v => v.status === 'processing' || v.status === 'pending');
  const failedVideos = videos.filter(v => v.status === 'failed');
  
  return (
    <div className="absolute bottom-4 right-4 w-96 space-y-3">
      {/* Video Player */}
      {activeVideo && (
        <div className="bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
          <div className="bg-gray-700 px-3 py-2 border-b border-gray-600 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-200">{activeVideo.sceneName}</span>
            {onDownloadVideo && (
              <Button
                onClick={() => onDownloadVideo(activeVideo.jobId)}
                variant="ghost"
                size="sm"
                className="text-xs text-gray-300 hover:text-white px-2 py-1"
              >
                Download
              </Button>
            )}
          </div>
          <video 
            src={activeVideo.videoUrl} 
            controls 
            autoPlay 
            loop 
            className="w-full"
            key={activeVideo.jobId} // Force re-render when switching videos
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      
      {/* Video Tabs */}
      {videos.length > 1 && (
        <div className="bg-gray-800 rounded-lg border border-gray-600 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">
              Videos ({completedVideos.length}/{videos.length} ready)
            </span>
            {onDownloadAll && completedVideos.length > 1 && (
              <Button
                onClick={onDownloadAll}
                variant="primary"
                size="sm"
                className="text-xs px-2 py-1"
              >
                Download All
              </Button>
            )}
          </div>
          
          <div className="space-y-1">
            {videos.map((video, index) => {
              const isCompleted = video.status === 'completed' && video.videoUrl;
              const isActive = isCompleted && completedVideos.indexOf(video) === activeVideoIndex;
              
              return (
                <div
                  key={video.jobId}
                  className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : isCompleted 
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                        : 'bg-gray-900 text-gray-400'
                  }`}
                  onClick={() => {
                    if (isCompleted) {
                      const completedIndex = completedVideos.indexOf(video);
                      if (completedIndex >= 0) {
                        setActiveVideoIndex(completedIndex);
                      }
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      video.status === 'completed' ? 'bg-green-400' :
                      video.status === 'processing' ? 'bg-yellow-400 animate-pulse' :
                      video.status === 'failed' ? 'bg-red-400' :
                      'bg-gray-500'
                    }`} />
                    <span className="truncate">{video.sceneName}</span>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    {video.status === 'completed' && '✓'}
                    {video.status === 'processing' && '⏳'}
                    {video.status === 'failed' && '✗'}
                    {video.status === 'pending' && '⏸'}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Progress Summary */}
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
            {processingVideos.length > 0 && (
              <div>⏳ {processingVideos.length} processing...</div>
            )}
            {failedVideos.length > 0 && (
              <div className="text-red-400">✗ {failedVideos.length} failed</div>
            )}
            {completedVideos.length > 0 && (
              <div className="text-green-400">✓ {completedVideos.length} completed</div>
            )}
          </div>
        </div>
      )}
      
      {/* No completed videos yet */}
      {videos.length > 0 && completedVideos.length === 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-600 p-4 text-center">
          <div className="text-gray-400 text-sm mb-2">
            {processingVideos.length > 0 ? 'Processing videos...' : 'Waiting for videos...'}
          </div>
          <div className="flex justify-center">
            <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}


