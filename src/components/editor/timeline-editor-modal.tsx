"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TRACK_COLORS, TRACK_ICONS } from "@/lib/constants/editor";
import { getDefaultTrackProperties } from "@/lib/defaults/nodes";
import type { AnimationTrack } from "@/lib/types/nodes";

interface TimelineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  duration: number;
  tracks: AnimationTrack[];
  onSave: (duration: number, tracks: AnimationTrack[]) => void;
}

interface DragState {
  trackId: string;
  type: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  startTime: number;
  startDuration: number;
}

const TIMELINE_WIDTH = 800;

export function TimelineEditorModal({
  isOpen,
  onClose,
  duration: initialDuration,
  tracks: initialTracks,
  onSave
}: TimelineEditorModalProps) {
  const [duration, setDuration] = useState(initialDuration);
  const [tracks, setTracks] = useState<AnimationTrack[]>(initialTracks || []);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDuration(initialDuration);
      setTracks(initialTracks || []);
      setSelectedTrackId(null);
      setDragState(null);
    }
  }, [isOpen, initialDuration, initialTracks]);

  const addTrack = useCallback((type: AnimationTrack['type']) => {
    const newTrack: AnimationTrack = {
      id: `${type}-${Date.now()}`,
      type,
      startTime: 0,
      duration: Math.min(2, duration),
      easing: type === 'rotate' ? 'linear' : 'easeInOut',
      properties: getDefaultTrackProperties(type)
    } as AnimationTrack;
    
    setTracks(prev => [...prev, newTrack]);
  }, [duration]);

  const updateTrack = useCallback((trackId: string, updates: Partial<AnimationTrack>) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId ? { ...track, ...updates } : track
    ));
  }, []);

  const deleteTrack = useCallback((trackId: string) => {
    setTracks(prev => prev.filter(track => track.id !== trackId));
    if (selectedTrackId === trackId) {
      setSelectedTrackId(null);
    }
  }, [selectedTrackId]);

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    trackId: string,
    type: DragState['type']
  ) => {
    e.preventDefault();
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    setDragState({
      trackId,
      type,
      startX: e.clientX,
      startTime: track.startTime,
      startDuration: track.duration
    });
  }, [tracks]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;

    const track = tracks.find(t => t.id === dragState.trackId);
    if (!track) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaTime = (deltaX / TIMELINE_WIDTH) * duration;

    switch (dragState.type) {
      case 'move':
        const newStartTime = Math.max(0, Math.min(
          duration - track.duration,
          dragState.startTime + deltaTime
        ));
        updateTrack(dragState.trackId, { startTime: newStartTime });
        break;
      
      case 'resize-start':
        const newStart = Math.max(0, Math.min(
          dragState.startTime + dragState.startDuration - 0.1,
          dragState.startTime + deltaTime
        ));
        const newDuration = dragState.startDuration - (newStart - dragState.startTime);
        updateTrack(dragState.trackId, { 
          startTime: newStart, 
          duration: Math.max(0.1, newDuration)
        });
        break;
      
      case 'resize-end':
        const newDur = Math.max(0.1, Math.min(
          duration - dragState.startTime,
          dragState.startDuration + deltaTime
        ));
        updateTrack(dragState.trackId, { duration: newDur });
        break;
    }
  }, [dragState, tracks, duration, updateTrack]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const handleSave = () => {
    onSave(duration, tracks);
    onClose();
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Timeline Editor"
      size="xl"
    >
      <div className="flex h-full">
        <div className="flex-1 p-4 overflow-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300">Duration:</label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-20 text-sm"
              />
              <span className="text-sm text-gray-400">seconds</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} variant="success" size="sm">
                Save
              </Button>
              <Button onClick={onClose} variant="secondary" size="sm">
                Cancel
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-300">Add Track:</span>
              {(['move', 'rotate', 'scale', 'fade', 'color'] as const).map((type) => (
                <Button
                  key={type}
                  onClick={() => addTrack(type)}
                  className={cn("text-xs", TRACK_COLORS[type])}
                  size="sm"
                >
                  {TRACK_ICONS[type]} {type}
                </Button>
              ))}
            </div>
          </div>

          <div 
            ref={timelineRef}
            className="relative bg-gray-900 rounded-lg p-4"
            style={{ width: `${TIMELINE_WIDTH}px` }}
          >
            <div className="relative h-6 mb-4">
              {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${(i / duration) * 100}%` }}
                >
                  <div className="w-px h-4 bg-gray-500" />
                  <span className="text-xs text-gray-400 mt-1">{i}s</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {tracks.map((track) => (
                <div key={track.id} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white w-16">
                        {TRACK_ICONS[track.type]} {track.type}
                      </span>
                      {selectedTrackId === track.id && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          SELECTED
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => deleteTrack(track.id)}
                      variant="danger"
                      size="sm"
                      className="text-xs"
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="relative h-8 bg-gray-700 rounded">
                    <div
                      className={cn(
                        "absolute h-6 rounded cursor-move transition-all text-white",
                        TRACK_COLORS[track.type],
                        selectedTrackId === track.id ? 'ring-2 ring-blue-400 shadow-lg' : 'hover:brightness-110',
                        dragState?.trackId === track.id ? 'opacity-80' : ''
                      )}
                      style={{
                        left: `${(track.startTime / duration) * 100}%`,
                        width: `${(track.duration / duration) * 100}%`,
                        top: '1px'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, track.id, 'move')}
                      onClick={() => setSelectedTrackId(track.id)}
                    >
                      <div className="flex items-center justify-between h-full px-2">
                        <span className="text-xs font-medium truncate">
                          {track.type}
                        </span>
                        <span className="text-xs text-white/80">
                          {track.duration.toFixed(1)}s
                        </span>
                      </div>
                    </div>

                    <div
                      className="absolute w-3 h-6 cursor-w-resize bg-white/30 hover:bg-white/50 rounded-l z-10"
                      style={{
                        left: `${(track.startTime / duration) * 100}%`,
                        top: '1px'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, track.id, 'resize-start')}
                    />
                    <div
                      className="absolute w-3 h-6 cursor-e-resize bg-white/30 hover:bg-white/50 rounded-r z-10"
                      style={{
                        left: `${((track.startTime + track.duration) / duration) * 100 - 12/TIMELINE_WIDTH*100}%`,
                        top: '1px'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, track.id, 'resize-end')}
                    />
                  </div>

                  <div className="text-xs text-gray-400 mt-1">
                    {track.startTime.toFixed(1)}s - {(track.startTime + track.duration).toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>

            {tracks.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-lg mb-2">No animation tracks</div>
                <div className="text-sm mb-4">Click the colored buttons above to add animation tracks</div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 border-l border-gray-600 p-4 bg-gray-850">
          <h3 className="text-lg font-semibold text-white mb-4">Properties</h3>
          
          {selectedTrack ? (
            <TrackProperties 
              track={selectedTrack}
              onChange={(updates) => updateTrack(selectedTrack.id, updates)}
            />
          ) : (
            <div className="text-gray-400 text-sm">
              Click a track to select and edit its properties
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TrackProperties({ 
  track, 
  onChange 
}: { 
  track: AnimationTrack; 
  onChange: (updates: Partial<AnimationTrack>) => void; 
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Easing</label>
        <Select
          value={track.easing}
          onChange={(e) => onChange({ easing: e.target.value as any })}
        >
          <option value="linear">Linear</option>
          <option value="easeInOut">Ease In Out</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut">Ease Out</option>
        </Select>
      </div>

      {track.type === 'move' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Move Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From X</label>
              <Input
                type="number"
                value={track.properties.from?.x ?? 0}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    from: { ...track.properties.from, x: Number(e.target.value) }
                  }
                })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Y</label>
              <Input
                type="number"
                value={track.properties.from?.y ?? 0}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    from: { ...track.properties.from, y: Number(e.target.value) }
                  }
                })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To X</label>
              <Input
                type="number"
                value={track.properties.to?.x ?? 0}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    to: { ...track.properties.to, x: Number(e.target.value) }
                  }
                })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Y</label>
              <Input
                type="number"
                value={track.properties.to?.y ?? 0}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    to: { ...track.properties.to, y: Number(e.target.value) }
                  }
                })}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {track.type === 'rotate' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Rotate Properties</div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rotations</label>
            <Input
              type="number"
              step="0.1"
              value={track.properties.rotations ?? 1}
              onChange={(e) => onChange({ 
                properties: { ...track.properties, rotations: Number(e.target.value) }
              })}
              className="text-sm"
            />
          </div>
        </div>
      )}

      {track.type === 'scale' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Scale Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From</label>
              <Input
                type="number"
                step="0.1"
                value={track.properties.from ?? 1}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, from: Number(e.target.value) }
                })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To</label>
              <Input
                type="number"
                step="0.1"
                value={track.properties.to ?? 1}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, to: Number(e.target.value) }
                })}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {track.type === 'fade' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Fade Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Opacity</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={track.properties.from ?? 1}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, from: Number(e.target.value) }
                })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Opacity</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={track.properties.to ?? 0.5}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, to: Number(e.target.value) }
                })}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {track.type === 'color' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Color Properties</div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Property</label>
            <Select
              value={track.properties.property || 'fill'}
              onChange={(e) => onChange({ 
                properties: { ...track.properties, property: e.target.value }
              })}
              className="text-sm"
            >
              <option value="fill">Fill</option>
              <option value="stroke">Stroke</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Color</label>
              <Input
                type="color"
                value={track.properties.from || '#ff0000'}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, from: e.target.value }
                })}
                className="h-10"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Color</label>
              <Input
                type="color"
                value={track.properties.to || '#00ff00'}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, to: e.target.value }
                })}
                className="h-10"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}