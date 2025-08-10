// src/server/animation-processing/scene/track-renderers.ts
// Typed renderer mapping to convert editor tracks to scene animation tracks

import type { AnimationTrack, SceneAnimationTrack } from '@/shared/types';

export type TrackRenderer = (
  track: AnimationTrack,
  objectId: string,
  baselineTime: number
) => SceneAnimationTrack;

export const TRACK_RENDERERS: Record<AnimationTrack['type'], TrackRenderer> = {
  move: (track, objectId, baselineTime) => ({
    objectId,
    type: 'move',
    startTime: baselineTime + track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: {
      from: (track as Extract<AnimationTrack, { type: 'move' }>).properties.from,
      to: (track as Extract<AnimationTrack, { type: 'move' }>).properties.to,
    },
  }),
  rotate: (track, objectId, baselineTime) => ({
    objectId,
    type: 'rotate',
    startTime: baselineTime + track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: {
      from: 0,
      to: 0,
      rotations: (track as Extract<AnimationTrack, { type: 'rotate' }>).properties.rotations,
    },
  }),
  scale: (track, objectId, baselineTime) => ({
    objectId,
    type: 'scale',
    startTime: baselineTime + track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: {
      from: (track as Extract<AnimationTrack, { type: 'scale' }>).properties.from,
      to: (track as Extract<AnimationTrack, { type: 'scale' }>).properties.to,
    },
  }),
  fade: (track, objectId, baselineTime) => ({
    objectId,
    type: 'fade',
    startTime: baselineTime + track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: {
      from: (track as Extract<AnimationTrack, { type: 'fade' }>).properties.from,
      to: (track as Extract<AnimationTrack, { type: 'fade' }>).properties.to,
    },
  }),
  color: (track, objectId, baselineTime) => ({
    objectId,
    type: 'color',
    startTime: baselineTime + track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: {
      from: (track as Extract<AnimationTrack, { type: 'color' }>).properties.from,
      to: (track as Extract<AnimationTrack, { type: 'color' }>).properties.to,
      property: (track as Extract<AnimationTrack, { type: 'color' }>).properties.property,
    },
  }),
};

export function convertTracksToSceneAnimations(
  tracks: AnimationTrack[],
  objectId: string,
  baselineTime: number
): SceneAnimationTrack[] {
  return tracks.map((track) => TRACK_RENDERERS[track.type](track, objectId, baselineTime));
}


