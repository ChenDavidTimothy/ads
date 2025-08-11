// src/animation/core/animation-chain-test.ts
// This file demonstrates the expected behavior of chained animations

import type { AnimationTrack, MoveTrack, RotateTrack, ScaleTrack } from '@/shared/types/nodes';
import type { Point2D } from '@/shared/types/core';

// Example: Chaining move and rotate animations
export function createChainedAnimationExample(): {
  moveTrack: MoveTrack;
  rotateTrack: RotateTrack;
  expectedBehavior: string;
} {
  // Animation 1: Move from (0,0) to (900,900)
  const moveTrack: MoveTrack = {
    id: 'move-1',
    type: 'move',
    startTime: 0,
    duration: 1000, // 1 second
    easing: 'easeInOut',
    properties: {
      from: { x: 0, y: 0 },
      to: { x: 900, y: 900 }
    }
  };

  // Animation 2: Rotate from 0 to 90 degrees, starting after move completes
  const rotateTrack: RotateTrack = {
    id: 'rotate-1',
    type: 'rotate',
    startTime: 1000, // Start exactly when move ends
    duration: 500,   // 0.5 seconds
    easing: 'linear',
    properties: {
      from: 0,        // Should inherit from previous rotation (0)
      to: 90          // Rotate to 90 degrees
    }
  };

  const expectedBehavior = `
Expected Behavior:
1. At time 0-1000ms: Object moves from (0,0) to (900,900)
2. At time 1000-1500ms: Object stays at (900,900) and rotates from 0° to 90°
3. At time 1500ms+: Object remains at (900,900) with 90° rotation

Key Points:
- Move animation completes fully before rotate starts
- Position (900,900) from move is preserved during rotation
- Rotation starts from 0° (not from some intermediate value)
- Both transforms are applied sequentially, not overwriting each other
  `;

  return {
    moveTrack,
    rotateTrack,
    expectedBehavior
  };
}

// Example: Multiple move animations in sequence
export function createSequentialMoveExample(): {
  move1: MoveTrack;
  move2: MoveTrack;
  expectedBehavior: string;
} {
  // First move: (0,0) to (100,100)
  const move1: MoveTrack = {
    id: 'move-1',
    type: 'move',
    startTime: 0,
    duration: 500,
    easing: 'easeInOut',
    properties: {
      from: { x: 0, y: 0 },
      to: { x: 100, y: 100 }
    }
  };

  // Second move: Should start from (100,100) and go to (200,200)
  const move2: MoveTrack = {
    id: 'move-2',
    type: 'move',
    startTime: 500, // Start when first move ends
    duration: 500,
    easing: 'easeInOut',
    properties: {
      from: { x: 100, y: 100 }, // Explicitly set to continue from where first move ended
      to: { x: 200, y: 200 }
    }
  };

  const expectedBehavior = `
Expected Behavior:
1. At time 0-500ms: Object moves from (0,0) to (100,100)
2. At time 500-1000ms: Object moves from (100,100) to (200,200)
3. At time 1000ms+: Object remains at (200,200)

Key Points:
- Second move starts exactly where first move ended
- No jumping or teleporting between positions
- Smooth continuous motion across both animations
  `;

  return {
    move1,
    move2,
    expectedBehavior
  };
}

// Example: Mixed transform types
export function createMixedTransformExample(): {
  moveTrack: MoveTrack;
  scaleTrack: ScaleTrack;
  expectedBehavior: string;
} {
  // Move animation
  const moveTrack: MoveTrack = {
    id: 'move-1',
    type: 'move',
    startTime: 0,
    duration: 1000,
    easing: 'easeInOut',
    properties: {
      from: { x: 0, y: 0 },
      to: { x: 500, y: 500 }
    }
  };

  // Scale animation (simplified for example)
  const scaleTrack: ScaleTrack = {
    id: 'scale-1',
    type: 'scale',
    startTime: 1000, // Start when move ends
    duration: 500,
    easing: 'easeInOut',
    properties: {
      from: 1,    // Start from normal size
      to: 2       // Scale to 2x size
    }
  };

  const expectedBehavior = `
Expected Behavior:
1. At time 0-1000ms: Object moves from (0,0) to (500,500) at normal size
2. At time 1000-1500ms: Object stays at (500,500) and scales from 1x to 2x
3. At time 1500ms+: Object remains at (500,500) at 2x size

Key Points:
- Position from move is preserved during scaling
- Scale starts from 1x (not from some intermediate value)
- Both transforms work together: object is at (500,500) and 2x size
  `;

  return {
    moveTrack,
    scaleTrack,
    expectedBehavior
  };
}

// Helper function to simulate animation state at different times
export function simulateAnimationState(
  tracks: AnimationTrack[],
  time: number
): { position: Point2D; rotation: number; scale: number } {
  // This is a simplified simulation for demonstration
  // In the real system, this would use the transform evaluator
  
  let position: Point2D = { x: 0, y: 0 };
  let rotation = 0;
  let scale = 1;

  for (const track of tracks) {
    if (time >= track.startTime && time < track.startTime + track.duration) {
      // Animation is active
      const progress = (time - track.startTime) / track.duration;
      
      if (track.type === 'move') {
        const props = track.properties;
        position.x = props.from.x + (props.to.x - props.from.x) * progress;
        position.y = props.from.y + (props.to.y - props.from.y) * progress;
      } else if (track.type === 'rotate') {
        const props = track.properties;
        rotation = props.from + (props.to - props.from) * progress;
      } else if (track.type === 'scale') {
        const props = track.properties;
        scale = props.from + (props.to - props.from) * progress;
      }
    } else if (time >= track.startTime + track.duration) {
      // Animation has completed, use end values
      if (track.type === 'move') {
        const props = track.properties;
        position = props.to;
      } else if (track.type === 'rotate') {
        const props = track.properties;
        rotation = props.to;
      } else if (track.type === 'scale') {
        const props = track.properties;
        scale = props.to;
      }
    }
  }

  return { position, rotation, scale };
}