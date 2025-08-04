// src/server/api/routers/animation.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { 
  generateSceneAnimation, 
  DEFAULT_SCENE_CONFIG,
  type SceneAnimationConfig 
} from "@/animation/scene-generator";
import { validateScene } from "@/animation/scene/scene";

// Scene config schema
const sceneConfigSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  backgroundColor: z.string().optional(),
  videoPreset: z.string().optional(),
  videoCrf: z.number().optional(),
});

// Scene object schemas
const point2DSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const trianglePropertiesSchema = z.object({
  size: z.number(),
  color: z.string(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
});

const circlePropertiesSchema = z.object({
  radius: z.number(),
  color: z.string(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
});

const rectanglePropertiesSchema = z.object({
  width: z.number(),
  height: z.number(),
  color: z.string(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
});

const sceneObjectSchema = z.object({
  id: z.string(),
  type: z.enum(['triangle', 'circle', 'rectangle']),
  properties: z.union([trianglePropertiesSchema, circlePropertiesSchema, rectanglePropertiesSchema]),
  initialPosition: point2DSchema,
  initialRotation: z.number().optional(),
  initialScale: point2DSchema.optional(),
  initialOpacity: z.number().min(0).max(1).optional(),
});

// Animation property schemas
const moveAnimationSchema = z.object({
  from: point2DSchema,
  to: point2DSchema,
});

const rotateAnimationSchema = z.object({
  from: z.number(),
  to: z.number(),
  rotations: z.number().optional(),
});

const scaleAnimationSchema = z.object({
  from: z.union([point2DSchema, z.number()]),
  to: z.union([point2DSchema, z.number()]),
});

const fadeAnimationSchema = z.object({
  from: z.number().min(0).max(1),
  to: z.number().min(0).max(1),
});

const colorAnimationSchema = z.object({
  from: z.string(),
  to: z.string(),
  property: z.enum(['fill', 'stroke']),
});

// Discriminated union for animation tracks
const animationTrackSchema = z.discriminatedUnion('type', [
  z.object({
    objectId: z.string(),
    type: z.literal('move'),
    startTime: z.number().min(0),
    duration: z.number().min(0),
    easing: z.enum(['linear', 'easeInOut', 'easeIn', 'easeOut']),
    properties: moveAnimationSchema,
  }),
  z.object({
    objectId: z.string(),
    type: z.literal('rotate'),
    startTime: z.number().min(0),
    duration: z.number().min(0),
    easing: z.enum(['linear', 'easeInOut', 'easeIn', 'easeOut']),
    properties: rotateAnimationSchema,
  }),
  z.object({
    objectId: z.string(),
    type: z.literal('scale'),
    startTime: z.number().min(0),
    duration: z.number().min(0),
    easing: z.enum(['linear', 'easeInOut', 'easeIn', 'easeOut']),
    properties: scaleAnimationSchema,
  }),
  z.object({
    objectId: z.string(),
    type: z.literal('fade'),
    startTime: z.number().min(0),
    duration: z.number().min(0),
    easing: z.enum(['linear', 'easeInOut', 'easeIn', 'easeOut']),
    properties: fadeAnimationSchema,
  }),
  z.object({
    objectId: z.string(),
    type: z.literal('color'),
    startTime: z.number().min(0),
    duration: z.number().min(0),
    easing: z.enum(['linear', 'easeInOut', 'easeIn', 'easeOut']),
    properties: colorAnimationSchema,
  }),
]);

const animationSceneSchema = z.object({
  duration: z.number().min(0),
  objects: z.array(sceneObjectSchema),
  animations: z.array(animationTrackSchema),
  background: z.object({
    color: z.string(),
  }).optional(),
});

export const animationRouter = createTRPCRouter({
  // Main scene-based endpoint
  generateScene: publicProcedure
    .input(z.object({
      scene: animationSceneSchema,
      config: sceneConfigSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const config: SceneAnimationConfig = {
          ...DEFAULT_SCENE_CONFIG,
          ...input.config,
        };
        
        const videoUrl = await generateSceneAnimation(input.scene, config);
        
        return {
          success: true,
          videoUrl,
          scene: input.scene,
          config,
        };
      } catch (error) {
        console.error("Scene animation generation failed:", error);
        throw new Error(
          error instanceof Error 
            ? `Scene animation generation failed: ${error.message}`
            : "Scene animation generation failed with unknown error"
        );
      }
    }),

  // Utility endpoints
  getDefaultSceneConfig: publicProcedure
    .query(() => {
      return DEFAULT_SCENE_CONFIG;
    }),

  getDefaultTriangleConfig: publicProcedure
    .query(() => {
      return {
        width: 1920,
        height: 1080,
        fps: 60,
        duration: 3,
        triangleSize: 80,
        margin: 100,
        rotations: 2,
        backgroundColor: '#000000',
        triangleColor: '#ff4444',
        strokeColor: '#ffffff',
        strokeWidth: 3,
        videoPreset: 'medium',
        videoCrf: 18,
      };
    }),

  validateScene: publicProcedure
    .input(animationSceneSchema)
    .query(({ input }) => {
      const errors = validateScene(input);
      return {
        valid: errors.length === 0,
        errors,
      };
    }),
});