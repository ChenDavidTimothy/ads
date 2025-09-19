# Animation Chaining System

## Overview

The animation chaining system allows you to create sequences of animations where each animation starts after the previous one completes, and transforms are properly accumulated rather than overwritten.

## How It Works

### 1. Transform Accumulation

When animations are chained together, the system:

- **Preserves completed transforms**: Once an animation finishes, its final state becomes the starting point for subsequent animations
- **Accumulates transforms**: Multiple transforms of different types (move, rotate, scale) work together
- **Maintains timing**: Each animation waits for the previous one to complete before starting

### 2. Chaining Logic

The system uses a priority-based approach for determining the "from" values:

1. **Explicit "from" value** in track properties (highest priority)
2. **End value from previous track** of the same type in the same sequence
3. **End value from prior animations** for the same object
4. **Default "from" value** (lowest priority)

### 3. Example Scenarios

#### Scenario 1: Move then Rotate

```typescript
// Animation 1: Move from (0,0) to (900,900)
const moveTrack = {
  type: 'move',
  startTime: 0,
  duration: 1000,
  properties: {
    from: { x: 0, y: 0 },
    to: { x: 900, y: 900 },
  },
};

// Animation 2: Rotate from 0° to 90°
const rotateTrack = {
  type: 'rotate',
  startTime: 1000, // Start when move ends
  duration: 500,
  properties: {
    from: 0, // Will inherit from previous rotation
    to: 90,
  },
};
```

**Result**: Object moves to (900,900), then rotates in place from 0° to 90°

#### Scenario 2: Sequential Moves

```typescript
// First move: (0,0) to (100,100)
const move1 = {
  type: 'move',
  startTime: 0,
  duration: 500,
  properties: {
    from: { x: 0, y: 0 },
    to: { x: 100, y: 100 },
  },
};

// Second move: (100,100) to (200,200)
const move2 = {
  type: 'move',
  startTime: 500, // Start when first move ends
  duration: 500,
  properties: {
    from: { x: 100, y: 100 }, // Explicitly set to continue
    to: { x: 200, y: 200 },
  },
};
```

**Result**: Smooth continuous motion from (0,0) → (100,100) → (200,200)

#### Scenario 3: Mixed Transform Types

```typescript
// Move animation
const moveTrack = {
  type: 'move',
  startTime: 0,
  duration: 1000,
  properties: {
    from: { x: 0, y: 0 },
    to: { x: 500, y: 500 },
  },
};

// Scale animation
const scaleTrack = {
  type: 'scale',
  startTime: 1000, // Start when move ends
  duration: 500,
  properties: {
    from: 1, // Start from normal size
    to: 2, // Scale to 2x size
  },
};
```

**Result**: Object moves to (500,500), then scales from 1x to 2x while maintaining position

## Implementation Details

### Key Components

1. **Scene Assembler** (`src/server/animation-processing/scene/scene-assembler.ts`)
   - Handles the logic for determining "from" values
   - Implements the priority system for chaining
   - Ensures proper timing between animations

2. **Timeline System** (`src/animation/scene/timeline.ts`)
   - Accumulates transforms from completed animations
   - Maintains object state across animation sequences
   - Applies active and completed transforms correctly

3. **Transform Evaluator** (`src/shared/registry/transform-evaluator.ts`)
   - Evaluates individual transforms at specific times
   - Provides methods for accumulating multiple transforms
   - Handles interpolation and easing

### Transform Types Supported

- **Move**: Position changes (x, y coordinates)
- **Rotate**: Rotation changes (degrees)
- **Scale**: Size changes (uniform or non-uniform)
- **Fade**: Opacity changes
- **Color**: Fill and stroke color changes

### Timing Considerations

- **Relative timing**: Each animation's `startTime` is relative to the baseline time
- **Sequential execution**: Animations execute in order based on their start times
- **Duration inheritance**: Each animation maintains its specified duration
- **Easing preservation**: Each animation keeps its easing function

## Best Practices

### 1. Explicit "from" Values

When you want precise control over the starting point:

```typescript
properties: {
  from: { x: 100, y: 100 }, // Explicit starting position
  to: { x: 200, y: 200 }
}
```

### 2. Implicit Chaining

Let the system automatically determine the starting point:

```typescript
properties: {
  // from: omitted - will inherit from previous animation
  to: { x: 200, y: 200 }
}
```

### 3. Timing Coordination

Ensure proper sequencing:

```typescript
// Animation 1
startTime: 0,
duration: 1000

// Animation 2 (starts when 1 ends)
startTime: 1000,
duration: 500
```

### 4. Transform Type Separation

Use different transform types for different properties:

```typescript
// Move and rotate can happen simultaneously or sequentially
// Scale and fade can be applied independently
// Color changes can be layered with other transforms
```

## Troubleshooting

### Common Issues

1. **Transforms not accumulating**: Check that animations are properly chained in time
2. **Jumps between positions**: Ensure "from" values are correctly inherited
3. **Timing mismatches**: Verify that `startTime` values account for previous animation durations

### Debug Tips

1. Use the test examples in `src/animation/core/animation-chain-test.ts`
2. Check the console for warnings about missing transform definitions
3. Verify that object IDs match between animations
4. Ensure proper baseline time calculations

## Future Enhancements

- **Parallel animations**: Support for simultaneous transforms
- **Transform blending**: Smooth transitions between different transform types
- **Advanced easing**: More sophisticated easing functions for complex animations
- **Performance optimization**: Better caching and evaluation strategies
