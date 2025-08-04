"use client";

import type { Node } from "reactflow";
import { NumberField, ColorField, SelectField } from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { RESOLUTION_PRESETS, FPS_OPTIONS, VIDEO_PRESETS } from "@/lib/constants/editor";
import type { NodeData } from "@/lib/types/nodes";

interface PropertyPanelProps {
  node: Node<NodeData>;
  onChange: (data: Partial<NodeData>) => void;
}

export function PropertyPanel({ node, onChange }: PropertyPanelProps) {
  const data = node.data;

  switch (node.type) {
    case "triangle":
      return <TriangleProperties data={data as any} onChange={onChange} />;
    case "circle":
      return <CircleProperties data={data as any} onChange={onChange} />;
    case "rectangle":
      return <RectangleProperties data={data as any} onChange={onChange} />;
    case "animation":
      return <AnimationProperties data={data as any} onChange={onChange} />;
    case "scene":
      return <SceneProperties data={data as any} onChange={onChange} />;
    default:
      return (
        <div className="text-gray-400 text-sm">
          Select a node to edit its properties
        </div>
      );
  }
}

function TriangleProperties({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-4">
      <NumberField
        label="Size"
        value={data.size}
        onChange={(size) => onChange({ size })}
        min={1}
      />
      <ColorField
        label="Color"
        value={data.color}
        onChange={(color) => onChange({ color })}
      />
      <NumberField
        label="Position X"
        value={data.position.x}
        onChange={(x) => onChange({ position: { ...data.position, x } })}
      />
      <NumberField
        label="Position Y"
        value={data.position.y}
        onChange={(y) => onChange({ position: { ...data.position, y } })}
      />
    </div>
  );
}

function CircleProperties({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-4">
      <NumberField
        label="Radius"
        value={data.radius}
        onChange={(radius) => onChange({ radius })}
        min={1}
      />
      <ColorField
        label="Color"
        value={data.color}
        onChange={(color) => onChange({ color })}
      />
      <NumberField
        label="Position X"
        value={data.position.x}
        onChange={(x) => onChange({ position: { ...data.position, x } })}
      />
      <NumberField
        label="Position Y"
        value={data.position.y}
        onChange={(y) => onChange({ position: { ...data.position, y } })}
      />
    </div>
  );
}

function RectangleProperties({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-4">
      <NumberField
        label="Width"
        value={data.width}
        onChange={(width) => onChange({ width })}
        min={1}
      />
      <NumberField
        label="Height"
        value={data.height}
        onChange={(height) => onChange({ height })}
        min={1}
      />
      <ColorField
        label="Color"
        value={data.color}
        onChange={(color) => onChange({ color })}
      />
      <NumberField
        label="Position X"
        value={data.position.x}
        onChange={(x) => onChange({ position: { ...data.position, x } })}
      />
      <NumberField
        label="Position Y"
        value={data.position.y}
        onChange={(y) => onChange({ position: { ...data.position, y } })}
      />
    </div>
  );
}

function AnimationProperties({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-4">
      <NumberField
        label="Duration (seconds)"
        value={data.duration}
        onChange={(duration) => onChange({ duration })}
        min={0.1}
        step={0.1}
      />
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Tracks</label>
        <div className="text-xs text-gray-400">
          {data.tracks?.length || 0} animation tracks defined
        </div>
        <div className="text-xs text-blue-400 mt-2">
          Double-click the node to edit timeline
        </div>
      </div>
    </div>
  );
}

function SceneProperties({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Video Resolution</h4>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Width"
            value={data.width}
            onChange={(width) => onChange({ width })}
            min={1}
          />
          <NumberField
            label="Height"
            value={data.height}
            onChange={(height) => onChange({ height })}
            min={1}
          />
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {RESOLUTION_PRESETS.map(preset => (
            <Button
              key={preset.label}
              onClick={() => onChange({ width: preset.width, height: preset.height })}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {preset.label} ({preset.width}×{preset.height})
            </Button>
          ))}
        </div>
      </div>

      <SelectField
        label="Frame Rate (FPS)"
        value={data.fps.toString()}
        onChange={(fps) => onChange({ fps: Number(fps) })}
        options={FPS_OPTIONS.map(opt => ({ value: opt.value.toString(), label: opt.label }))}
      />

      <NumberField
        label="Duration (seconds)"
        value={data.duration}
        onChange={(duration) => onChange({ duration })}
        min={0.1}
        step={0.1}
      />

      <ColorField
        label="Background Color"
        value={data.backgroundColor}
        onChange={(backgroundColor) => onChange({ backgroundColor })}
      />

      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Video Quality</h4>
        <div className="space-y-3">
          <SelectField
            label="Encoding Speed"
            value={data.videoPreset}
            onChange={(videoPreset) => onChange({ videoPreset })}
            options={VIDEO_PRESETS.map(preset => ({ value: preset.value, label: preset.label }))}
          />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Quality Level (CRF: {data.videoCrf})</label>
            <input
              type="range"
              min="0"
              max="51"
              value={data.videoCrf}
              onChange={(e) => onChange({ videoCrf: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Highest (0)</span>
              <span>Medium (23)</span>
              <span>Lowest (51)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}