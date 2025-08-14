import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineEditorCore } from './timeline-editor-core';
import type { WorkspaceState, TimelineEditorData } from '@/types/workspace-state';
import { WorkspaceContext } from './workspace-context';

function TestWorkspaceProvider({ children }: { children: React.ReactNode }) {
	const mockState: WorkspaceState = {
		flow: { nodes: [], edges: [] },
		editors: { timeline: {} as Record<string, TimelineEditorData> },
		ui: { activeTab: 'timeline', selectedNodeId: 'n1', selectedNodeType: 'animation' }
	};
	const value = {
		state: mockState,
		updateFlow: vi.fn(),
		updateTimeline: vi.fn(),
		updateUI: vi.fn(),
		saveNow: vi.fn(),
		isSaving: false,
		hasUnsavedChanges: false,
		lastSaved: null,
		hasBackup: false,
	};
	return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

const baseTrack = {
  startTime: 0,
  duration: 1,
  easing: 'easeInOut' as const,
  type: 'move' as const,
  properties: { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
  identifier: { id: 't1', type: 'move', createdAt: Date.now(), sequence: 1, displayName: 'Move 1' },
};

describe('TimelineEditorCore (controlled)', () => {
  it('calls onChange when duration edited', () => {
    const onChange = vi.fn();
    render(
      <TestWorkspaceProvider>
        <TimelineEditorCore animationNodeId="n1" duration={3} tracks={[baseTrack]} onChange={onChange} />
      </TestWorkspaceProvider>
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalled();
  });
});