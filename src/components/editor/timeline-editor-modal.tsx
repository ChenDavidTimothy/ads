"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { AnimationTrack } from "./nodes/animation-node";

interface TimelineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  duration: number;
  tracks: AnimationTrack[];
  onSave: (duration: number, tracks: AnimationTrack[]) => void;
}

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
  const [dragState, setDragState] = useState<{
    trackId: string;
    type: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    startTime: number;
    startDuration: number;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const TIMELINE_WIDTH = 800;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDuration(initialDuration);
      setTracks(initialTracks || []);
      setSelectedTrackId(null);
      setDragState(null);
      // Focus modal for keyboard events
      setTimeout(() => modalRef.current?.focus(), 100);
    }
  }, [isOpen, initialDuration, initialTracks]);

  const addTrack = useCallback((type: AnimationTrack['type']) => {
    const newTrack: AnimationTrack = {
      id: `${type}-${Date.now()}`,
      type,
      startTime: 0,
      duration: Math.min(2, duration),
      easing: type === 'rotate' ? 'linear' : 'easeInOut',
      properties: getDefaultProperties(type)
    };
    
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
    type: 'move' | 'resize-start' | 'resize-end'
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

  // Global mouse events for dragging
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-gray-800 rounded-lg border border-gray-600 w-[95vw] h-[90vh] max-w-6xl flex flex-col outline-none"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Timeline Editor</h2>
            {selectedTrackId && (
              <div className="text-sm text-blue-400">
                Selected: {tracks.find(t => t.id === selectedTrackId)?.type} track
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300">Duration:</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-20 rounded bg-gray-700 border-gray-600 text-white px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-400">seconds</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Timeline Area */}
          <div className="flex-1 p-4 overflow-auto">
            {/* Add Track Buttons */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-300">Add Track:</span>
                {['move', 'rotate', 'scale', 'fade', 'color'].map((type) => (
                  <button
                    key={type}
                    onClick={() => addTrack(type as AnimationTrack['type'])}
                    className={`px-3 py-1 rounded text-white text-sm font-medium transition-colors ${getTrackColor(type)}`}
                  >
                    {getTrackIcon(type)} {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Ruler */}
            <div className="mb-4">
              <div 
                ref={timelineRef}
                className="relative bg-gray-900 rounded-lg p-4"
                style={{ width: `${TIMELINE_WIDTH}px` }}
              >
                {/* Time markers */}
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

                {/* Tracks */}
                <div className="space-y-3">
                  {tracks.map((track) => (
                    <div key={track.id} className="relative">
                      {/* Track Label */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white w-16">
                            {getTrackIcon(track.type)} {track.type}
                          </span>
                          {selectedTrackId === track.id && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                              SELECTED
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => deleteTrack(track.id)}
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                        >
                          🗑 Delete
                        </button>
                      </div>

                      {/* Track Lane */}
                      <div className="relative h-8 bg-gray-700 rounded">
                        {/* Track Bar */}
                        <div
                          className={`absolute h-6 rounded cursor-move transition-all ${getTrackColorBg(track.type)} ${
                            selectedTrackId === track.id ? 'ring-2 ring-blue-400 shadow-lg' : 'hover:brightness-110'
                          } ${dragState?.trackId === track.id ? 'opacity-80' : ''}`}
                          style={{
                            left: `${(track.startTime / duration) * 100}%`,
                            width: `${(track.duration / duration) * 100}%`,
                            top: '1px'
                          }}
                          onMouseDown={(e) => handleMouseDown(e, track.id, 'move')}
                          onClick={() => setSelectedTrackId(track.id)}
                        >
                          <div className="flex items-center justify-between h-full px-2">
                            <span className="text-xs font-medium text-white truncate">
                              {track.type}
                            </span>
                            <span className="text-xs text-white/80">
                              {track.duration.toFixed(1)}s
                            </span>
                          </div>
                        </div>

                        {/* Resize Handles */}
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

                      {/* Timing Info */}
                      <div className="text-xs text-gray-400 mt-1">
                        {track.startTime.toFixed(1)}s - {(track.startTime + track.duration).toFixed(1)}s
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {tracks.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-lg mb-2">No animation tracks</div>
                    <div className="text-sm mb-4">Click the colored buttons above to add animation tracks</div>
                    <div className="text-xs text-gray-600">
                      <div>• Click tracks to select them</div>
                      <div>• Drag tracks to reposition</div>
                      <div>• Drag edges to resize duration</div>
                      <div>• Use delete buttons to remove tracks</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Properties Panel */}
          <div className="w-80 border-l border-gray-600 p-4 bg-gray-850">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Properties</h3>
              {selectedTrackId && (
                <button
                  onClick={() => deleteTrack(selectedTrackId)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                >
                  🗑 Delete Track
                </button>
              )}
            </div>
            
            {selectedTrack ? (
              <div>
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                  <div className="text-sm font-medium text-blue-400 mb-1">
                    {getTrackIcon(selectedTrack.type)} {selectedTrack.type.toUpperCase()} Track
                  </div>
                  <div className="text-xs text-gray-400">
                    Edit properties below
                  </div>
                </div>
                <TrackProperties 
                  track={selectedTrack}
                  onChange={(updates) => updateTrack(selectedTrack.id, updates)}
                />
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                Click a track to select and edit its properties
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
      {/* Easing */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Easing</label>
        <select
          value={track.easing}
          onChange={(e) => onChange({ easing: e.target.value as any })}
          className="w-full rounded bg-gray-700 border-gray-600 text-white px-3 py-2"
        >
          <option value="linear">Linear</option>
          <option value="easeInOut">Ease In Out</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut">Ease Out</option>
        </select>
      </div>

      {/* Move Properties */}
      {track.type === 'move' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Move Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From X</label>
              <input
                type="number"
                value={track.properties.from?.x ?? ''}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    from: { ...track.properties.from, x: e.target.value === '' ? '' : Number(e.target.value) }
                  }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { 
                        ...track.properties, 
                        from: { ...track.properties.from, x: 0 }
                      }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.from?.x === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.from?.x === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Y</label>
              <input
                type="number"
                value={track.properties.from?.y ?? ''}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    from: { ...track.properties.from, y: e.target.value === '' ? '' : Number(e.target.value) }
                  }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { 
                        ...track.properties, 
                        from: { ...track.properties.from, y: 0 }
                      }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.from?.y === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.from?.y === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To X</label>
              <input
                type="number"
                value={track.properties.to?.x ?? ''}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    to: { ...track.properties.to, x: e.target.value === '' ? '' : Number(e.target.value) }
                  }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { 
                        ...track.properties, 
                        to: { ...track.properties.to, x: 0 }
                      }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.to?.x === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.to?.x === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Y</label>
              <input
                type="number"
                value={track.properties.to?.y ?? ''}
                onChange={(e) => onChange({ 
                  properties: { 
                    ...track.properties, 
                    to: { ...track.properties.to, y: e.target.value === '' ? '' : Number(e.target.value) }
                  }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { 
                        ...track.properties, 
                        to: { ...track.properties.to, y: 0 }
                      }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.to?.y === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.to?.y === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rotate Properties */}
      {track.type === 'rotate' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Rotate Properties</div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rotations</label>
            <input
              type="number"
              step="0.1"
              value={track.properties.rotations ?? ''}
              onChange={(e) => onChange({ 
                properties: { ...track.properties, rotations: e.target.value === '' ? '' : Number(e.target.value) }
              })}
              onBlur={(e) => {
                if (e.target.value === '') {
                  onChange({ 
                    properties: { ...track.properties, rotations: 1 }
                  });
                }
              }}
              className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                track.properties.rotations === '' ? 'border-red-500' : 'border-gray-600'
              }`}
            />
            {track.properties.rotations === '' && (
              <div className="text-xs text-red-400 mt-1">Required</div>
            )}
          </div>
        </div>
      )}

      {/* Scale Properties */}
      {track.type === 'scale' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Scale Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From</label>
              <input
                type="number"
                step="0.1"
                value={track.properties.from ?? ''}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, from: e.target.value === '' ? '' : Number(e.target.value) }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { ...track.properties, from: 1 }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.from === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.from === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To</label>
              <input
                type="number"
                step="0.1"
                value={track.properties.to ?? ''}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, to: e.target.value === '' ? '' : Number(e.target.value) }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { ...track.properties, to: 1 }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.to === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.to === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fade Properties */}
      {track.type === 'fade' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Fade Properties</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Opacity</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={track.properties.from ?? ''}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, from: e.target.value === '' ? '' : Number(e.target.value) }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { ...track.properties, from: 1 }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.from === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.from === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Opacity</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={track.properties.to ?? ''}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, to: e.target.value === '' ? '' : Number(e.target.value) }
                })}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    onChange({ 
                      properties: { ...track.properties, to: 0.5 }
                    });
                  }
                }}
                className={`w-full rounded bg-gray-700 border text-white px-2 py-1 text-sm ${
                  track.properties.to === '' ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {track.properties.to === '' && (
                <div className="text-xs text-red-400 mt-1">Required</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Color Properties */}
      {track.type === 'color' && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Color Properties</div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Property</label>
            <select
              value={track.properties.property || 'fill'}
              onChange={(e) => onChange({ 
                properties: { ...track.properties, property: e.target.value }
              })}
              className="w-full rounded bg-gray-700 border-gray-600 text-white px-2 py-1 text-sm"
            >
              <option value="fill">Fill</option>
              <option value="stroke">Stroke</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Color</label>
              <input
                type="color"
                value={track.properties.from || '#ff0000'}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, from: e.target.value }
                })}
                className="w-full h-10 rounded bg-gray-700 border-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Color</label>
              <input
                type="color"
                value={track.properties.to || '#00ff00'}
                onChange={(e) => onChange({ 
                  properties: { ...track.properties, to: e.target.value }
                })}
                className="w-full h-10 rounded bg-gray-700 border-gray-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTrackIcon(type: string): string {
  switch (type) {
    case 'move': return '→';
    case 'rotate': return '↻';
    case 'scale': return '⚹';
    case 'fade': return '◐';
    case 'color': return '🎨';
    default: return '•';
  }
}

function getTrackColor(type: string): string {
  switch (type) {
    case 'move': return 'bg-purple-600 hover:bg-purple-700';
    case 'rotate': return 'bg-indigo-600 hover:bg-indigo-700';
    case 'scale': return 'bg-pink-600 hover:bg-pink-700';
    case 'fade': return 'bg-yellow-600 hover:bg-yellow-700';
    case 'color': return 'bg-orange-600 hover:bg-orange-700';
    default: return 'bg-gray-600 hover:bg-gray-700';
  }
}

function getTrackColorBg(type: string): string {
  switch (type) {
    case 'move': return 'bg-purple-600';
    case 'rotate': return 'bg-indigo-600';
    case 'scale': return 'bg-pink-600';
    case 'fade': return 'bg-yellow-600';
    case 'color': return 'bg-orange-600';
    default: return 'bg-gray-600';
  }
}

function getDefaultProperties(type: AnimationTrack['type']): any {
  switch (type) {
    case 'move':
      return { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
    case 'rotate':
      return { rotations: 1 };
    case 'scale':
      return { from: 1, to: 1.5 };
    case 'fade':
      return { from: 1, to: 0.5 };
    case 'color':
      return { from: '#ff0000', to: '#00ff00', property: 'fill' };
    default:
      return {};
  }
}