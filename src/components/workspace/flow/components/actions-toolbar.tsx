"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ChevronDown } from 'lucide-react';
import { GenerationSelector } from './generation-selector';
import type { Node } from 'reactflow';
import type { NodeData } from '@/shared/types';

interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  suggestions?: string[];
  nodeId?: string;
  nodeName?: string;
}

interface ValidationSummary {
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  primaryError: ValidationError | null;
  allSuggestions: string[];
}

interface Props {
  allNodes: Node<NodeData>[];
  
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;

  onGenerateImage: () => void;
  canGenerateImage: boolean;
  isGeneratingImage: boolean;

  onGenerateSelected: (sceneIds: string[], frameIds: string[]) => void;

  lastError?: string | null;
  onResetGeneration?: () => void;
  validationSummary?: ValidationSummary | null;
}

export function ActionsToolbar({ 
  allNodes,
  onGenerate, 
  canGenerate, 
  isGenerating, 
  onGenerateImage,
  canGenerateImage,
  isGeneratingImage,
  onGenerateSelected,
  lastError,
  onResetGeneration,
  validationSummary
}: Props) {
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);

  const sceneNodes = allNodes.filter(n => n.type === 'scene');
  const frameNodes = allNodes.filter(n => n.type === 'frame');
  const hasSelectableContent = sceneNodes.length > 0 || frameNodes.length > 0;

  const getButtonText = (isGenerating: boolean, type: 'video' | 'image') => {
    if (isGenerating) return type === 'video' ? 'Generating...' : 'Generating...';
    if (lastError || validationSummary?.hasErrors) return 'Fix Issues & Try Again';
    return type === 'video' ? 'Generate All Videos' : 'Generate All Images';
  };

  const getButtonVariant = () => {
    if (lastError || validationSummary?.hasErrors) return 'danger' as const;
    return 'success' as const;
  };

  const anyGenerating = isGenerating || isGeneratingImage;

  const handleToggleScene = (sceneId: string) => {
    setSelectedSceneIds(prev => 
      prev.includes(sceneId)
        ? prev.filter(id => id !== sceneId)
        : [...prev, sceneId]
    );
  };

  const handleToggleFrame = (frameId: string) => {
    setSelectedFrameIds(prev => 
      prev.includes(frameId)
        ? prev.filter(id => id !== frameId)
        : [...prev, frameId]
    );
  };

  const handleGenerate = () => {
    const hasSelection = selectedSceneIds.length > 0 || selectedFrameIds.length > 0;
    if (!hasSelection) return;
    
    onGenerateSelected(selectedSceneIds, selectedFrameIds);
    setShowSelectionModal(false);
    setSelectedSceneIds([]);
    setSelectedFrameIds([]);
  };

  const selectedTotal = selectedSceneIds.length + selectedFrameIds.length;

  return (
    <>
      <div className="flex items-center gap-[var(--space-2)]">
        {/* Batch Generation */}
        {sceneNodes.length > 0 && (
          <Button
            onClick={onGenerate}
            disabled={!canGenerate || anyGenerating}
            variant={getButtonVariant()}
            size="sm"
            className="font-medium"
          >
            {getButtonText(isGenerating, 'video')}
          </Button>
        )}

        {frameNodes.length > 0 && (
          <Button
            onClick={onGenerateImage}
            disabled={!canGenerateImage || anyGenerating}
            variant={getButtonVariant()}
            size="sm"
            className="font-medium"
          >
            {getButtonText(isGeneratingImage, 'image')}
          </Button>
        )}

        {/* Selective Generation */}
        {hasSelectableContent && (
          <Button
            onClick={() => setShowSelectionModal(true)}
            disabled={anyGenerating}
            variant="secondary"
            size="sm"
            className="font-medium"
          >
            Select & Generate
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        )}

        {/* Reset Button */}
        {(lastError ?? validationSummary?.hasErrors) && onResetGeneration && (
          <Button
            onClick={onResetGeneration}
            variant="ghost"
            size="sm"
            className="text-[var(--danger-500)] hover:text-[var(--danger-600)] border border-[var(--danger-600)]"
          >
            Reset Generation
          </Button>
        )}
      </div>

      {/* Selection Modal */}
      <Modal
        isOpen={showSelectionModal}
        onClose={() => setShowSelectionModal(false)}
        title="Select Content to Generate"
        size="md"
        variant="glass"
      >
        <div className="p-[var(--space-4)]">
          <GenerationSelector
            sceneNodes={sceneNodes}
            selectedSceneIds={selectedSceneIds}
            onToggleScene={handleToggleScene}
            onSelectAllScenes={() => setSelectedSceneIds(sceneNodes.map(n => n.data.identifier.id))}
            onSelectNoScenes={() => setSelectedSceneIds([])}
            
            frameNodes={frameNodes}
            selectedFrameIds={selectedFrameIds}
            onToggleFrame={handleToggleFrame}
            onSelectAllFrames={() => setSelectedFrameIds(frameNodes.map(n => n.data.identifier.id))}
            onSelectNoFrames={() => setSelectedFrameIds([])}
          />
          
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--border-primary)]">
            <Button 
              variant="ghost" 
              onClick={() => setShowSelectionModal(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate}
              disabled={selectedTotal === 0 || anyGenerating}
              variant="success"
            >
              {anyGenerating ? 'Generating...' : `Generate ${selectedTotal} Item${selectedTotal !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}