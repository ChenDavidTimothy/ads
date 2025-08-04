import type { NodeData, AnimationTrack } from "../types/nodes";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateNodeData(nodeData: NodeData): ValidationError[] {
  const errors: ValidationError[] = [];

  if ('position' in nodeData) {
    if (typeof nodeData.position.x !== 'number') {
      errors.push({ field: 'position.x', message: 'Position X is required' });
    }
    if (typeof nodeData.position.y !== 'number') {
      errors.push({ field: 'position.y', message: 'Position Y is required' });
    }
  }

  if ('size' in nodeData && nodeData.size <= 0) {
    errors.push({ field: 'size', message: 'Size must be greater than 0' });
  }

  if ('radius' in nodeData && nodeData.radius <= 0) {
    errors.push({ field: 'radius', message: 'Radius must be greater than 0' });
  }

  if ('width' in nodeData && nodeData.width <= 0) {
    errors.push({ field: 'width', message: 'Width must be greater than 0' });
  }

  if ('height' in nodeData && nodeData.height <= 0) {
    errors.push({ field: 'height', message: 'Height must be greater than 0' });
  }

  if ('duration' in nodeData && nodeData.duration <= 0) {
    errors.push({ field: 'duration', message: 'Duration must be greater than 0' });
  }

  return errors;
}

export function validateAnimationTrack(track: AnimationTrack): ValidationError[] {
  const errors: ValidationError[] = [];

  if (track.startTime < 0) {
    errors.push({ field: 'startTime', message: 'Start time cannot be negative' });
  }

  if (track.duration <= 0) {
    errors.push({ field: 'duration', message: 'Duration must be greater than 0' });
  }

  switch (track.type) {
    case 'move':
      if (!track.properties.from || typeof track.properties.from.x !== 'number') {
        errors.push({ field: 'from.x', message: 'From X is required' });
      }
      if (!track.properties.from || typeof track.properties.from.y !== 'number') {
        errors.push({ field: 'from.y', message: 'From Y is required' });
      }
      if (!track.properties.to || typeof track.properties.to.x !== 'number') {
        errors.push({ field: 'to.x', message: 'To X is required' });
      }
      if (!track.properties.to || typeof track.properties.to.y !== 'number') {
        errors.push({ field: 'to.y', message: 'To Y is required' });
      }
      break;

    case 'rotate':
      if (typeof track.properties.rotations !== 'number') {
        errors.push({ field: 'rotations', message: 'Rotations is required' });
      }
      break;

    case 'scale':
      if (typeof track.properties.from !== 'number') {
        errors.push({ field: 'from', message: 'From scale is required' });
      }
      if (typeof track.properties.to !== 'number') {
        errors.push({ field: 'to', message: 'To scale is required' });
      }
      break;

    case 'fade':
      if (typeof track.properties.from !== 'number' || track.properties.from < 0 || track.properties.from > 1) {
        errors.push({ field: 'from', message: 'From opacity must be between 0 and 1' });
      }
      if (typeof track.properties.to !== 'number' || track.properties.to < 0 || track.properties.to > 1) {
        errors.push({ field: 'to', message: 'To opacity must be between 0 and 1' });
      }
      break;

    case 'color':
      if (!track.properties.from || typeof track.properties.from !== 'string') {
        errors.push({ field: 'from', message: 'From color is required' });
      }
      if (!track.properties.to || typeof track.properties.to !== 'string') {
        errors.push({ field: 'to', message: 'To color is required' });
      }
      if (!['fill', 'stroke'].includes(track.properties.property)) {
        errors.push({ field: 'property', message: 'Property must be fill or stroke' });
      }
      break;
  }

  return errors;
}