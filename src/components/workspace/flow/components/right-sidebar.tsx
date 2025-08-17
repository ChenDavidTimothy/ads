// src/components/workspace/flow/components/right-sidebar.tsx
import type { Edge, Node } from 'reactflow';
import { Play, Settings, Folder } from 'lucide-react';
import { PropertyPanel } from '@/components/workspace/property-panel';
import { CollapsibleSection } from './collapsible-section';
import { PreviewPanel } from './preview-panel';
import { AssetsPanel } from './assets-panel';
import type { NodeData } from '@/shared/types';
import type { FlowTracker } from '@/lib/flow/flow-tracking';

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface ImageJob {
  jobId: string;
  frameName: string;
  frameId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
}

interface Props {
  // Existing property panel props
  node: Node<NodeData> | undefined;
  allNodes: Node<NodeData>[];
  allEdges: Edge[];
  onChange: (newData: Partial<NodeData>) => void;
  onDisplayNameChange: (nodeId: string, displayName: string) => boolean;
  validateDisplayName: (name: string, nodeId: string) => string | null;
  flowTracker: FlowTracker;

  // Preview panel props
  videoUrl?: string | null;
  videos?: VideoJob[];
  onDownloadVideo?: (jobId: string) => void;
  onDownloadAll?: () => void;
  imageUrl?: string | null;
  images?: ImageJob[];
  onDownloadImage?: (jobId: string) => void;
  onDownloadAllImages?: () => void;
}

export function RightSidebar({ 
  // Property panel props
  node, 
  allNodes, 
  allEdges, 
  onChange, 
  onDisplayNameChange, 
  validateDisplayName, 
  flowTracker,
  
  // Preview panel props
  videoUrl = null,
  videos = [],
  onDownloadVideo,
  onDownloadAll,
  imageUrl = null,
  images = [],
  onDownloadImage,
  onDownloadAllImages
}: Props) {
  const hasPreviewContent = Boolean(
    videoUrl || 
    videos.length > 0 || 
    imageUrl || 
    images.length > 0
  );

  return (
    <div className="w-[var(--sidebar-width)] bg-[var(--surface-1)] border-l border-[var(--border-primary)] overflow-y-auto">
      
      {/* Properties Section - Always visible */}
      <CollapsibleSection
        title="Properties"
        icon={<Settings size={16} />}
        defaultExpanded={true}
        persistKey="properties"
      >
        {node ? (
          // Node is selected - show properties
          <PropertyPanel
            node={node}
            onChange={(newData: Partial<NodeData>) => onChange(newData)}
            onDisplayNameChange={onDisplayNameChange}
            validateDisplayName={validateDisplayName}
            allNodes={allNodes}
            allEdges={allEdges}
            flowTracker={flowTracker}
          />
        ) : (
          // No node selected - show helpful message
          <div className="text-center py-[var(--space-6)] text-[var(--text-tertiary)]">
            <div className="text-sm">Click a node to see properties</div>
            <div className="text-xs mt-[var(--space-1)]">Select any node in the flow to edit its properties</div>
          </div>
        )}
      </CollapsibleSection>

      {/* Preview Section */}
      <CollapsibleSection
        title="Preview"
        icon={<Play size={16} />}
        defaultExpanded={hasPreviewContent}
        persistKey="preview"
      >
        <PreviewPanel
          videoUrl={videoUrl}
          videos={videos}
          onDownloadVideo={onDownloadVideo}
          onDownloadAll={onDownloadAll}
          imageUrl={imageUrl}
          images={images}
          onDownloadImage={onDownloadImage}
          onDownloadAllImages={onDownloadAllImages}
        />
      </CollapsibleSection>

      {/* Assets Section */}
      <CollapsibleSection
        title="Assets"
        icon={<Folder size={16} />}
        defaultExpanded={false}
        persistKey="assets"
      >
        <AssetsPanel />
      </CollapsibleSection>

    </div>
  );
}
