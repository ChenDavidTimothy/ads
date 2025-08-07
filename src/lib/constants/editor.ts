// src/lib/constants/editor.ts - Registry-driven constants
import { 
  generateNodeColors, 
  TRACK_COLORS, 
  TRACK_ICONS, 
  RESOLUTION_PRESETS 
} from '@/shared/registry/registry-utils';
import { VIDEO_PRESETS, FPS_OPTIONS } from '@/shared/types/definitions';

// Generate node colors dynamically from registry
export const NODE_COLORS = generateNodeColors();

// Track constants (preserved existing behavior)
export { TRACK_COLORS, TRACK_ICONS };

// Re-export from registry for backwards compatibility
export { VIDEO_PRESETS, FPS_OPTIONS, RESOLUTION_PRESETS };