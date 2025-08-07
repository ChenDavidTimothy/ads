// src/lib/constants/editor.ts
import { VIDEO_PRESETS, FPS_OPTIONS } from "@/shared/types/definitions";

export const NODE_COLORS = {
  triangle: {
    primary: "bg-red-600",
    handle: "!bg-red-500",
  },
  circle: {
    primary: "bg-blue-600", 
    handle: "!bg-blue-500",
  },
  rectangle: {
    primary: "bg-green-600",
    handle: "!bg-green-500", 
  },
  insert: {
    primary: "bg-orange-600",
    handle: "!bg-orange-500",
  },
  filter: {
    primary: "bg-violet-600",
    handle: "!bg-violet-500",
  },
  animation: {
    primary: "bg-purple-600",
    handle: "!bg-purple-500",
  },
  scene: {
    primary: "bg-gray-600",
    handle: "!bg-gray-500",
  },
} as const;

export const TRACK_COLORS = {
  move: "bg-purple-600",
  rotate: "bg-indigo-600", 
  scale: "bg-pink-600",
  fade: "bg-yellow-600",
  color: "bg-orange-600",
} as const;

export const TRACK_ICONS = {
  move: "→",
  rotate: "↻", 
  scale: "⚹",
  fade: "◐",
  color: "🎨",
} as const;

// Re-export from shared types
export { VIDEO_PRESETS, FPS_OPTIONS };

export const RESOLUTION_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "FHD", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "Square", width: 1080, height: 1080 },
] as const;